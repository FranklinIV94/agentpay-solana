"""
AgentPay CDK Infrastructure — Provisions all AWS resources

Architecture:
- DynamoDB: Payments, Wallets, Leaderboard tables
- Lambda: API, Indexer, x402 Facilitator, Bedrock Agent functions
- API Gateway: REST API with x402, Solana, and Bedrock endpoints
- SNS: Push notification topic
- CloudWatch: Dashboard, Alarms, Log Groups
- CloudFront + Lambda@Edge: x402 payment gating at the edge

Cross-chain flow:
  Base/x402 → CloudFront → Lambda@Edge → API Gateway → x402 Facilitator → Solana
  Solana events → Helius Webhook → Indexer Lambda → DynamoDB → Push notifications → Seeker
"""

from aws_cdk import (
    Stack,
    Duration,
    CfnOutput,
)
from constructs import Construct
from aws_cdk import aws_lambda as _lambda
from aws_cdk import aws_apigateway as apigw
from aws_cdk import aws_dynamodb as dynamodb
from aws_cdk import aws_sns as sns
from aws_cdk import aws_iam as iam
from aws_cdk import aws_cloudwatch as cloudwatch
from aws_cdk import aws_cloudwatch_actions as cloudwatch_actions
from aws_cdk import aws_logs as logs


class AgentPayStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # ─── DynamoDB Tables ─────────────────────────────────────────

        payments_table = dynamodb.Table(
            self, "PaymentsTable",
            partition_key=dynamodb.Attribute(name="paymentId", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="createdAt", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
        )
        payments_table.add_global_secondary_index(
            index_name="owner-status-index",
            partition_key=dynamodb.Attribute(name="owner", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="status", type=dynamodb.AttributeType.STRING),
        )

        wallets_table = dynamodb.Table(
            self, "WalletsTable",
            partition_key=dynamodb.Attribute(name="owner", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="agentName", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
        )

        leaderboard_table = dynamodb.Table(
            self, "LeaderboardTable",
            partition_key=dynamodb.Attribute(name="ownerId", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="date", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
        )
        leaderboard_table.add_global_secondary_index(
            index_name="date-score-index",
            partition_key=dynamodb.Attribute(name="date", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="totalAmount", type=dynamodb.AttributeType.NUMBER),
        )

        # ─── Lambda Functions ─────────────────────────────────────────

        agentpay_program_id = "D5yYFh3JDSKoKNGv6s4EDga4Ste7JPbyAS4GKuGuiQG7"

        indexer_lambda = _lambda.Function(
            self, "IndexerFunction",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="indexer.handler",
            code=_lambda.Code.from_asset("lambda"),
            environment={
                "PAYMENTS_TABLE": payments_table.table_name,
                "WALLETS_TABLE": wallets_table.table_name,
                "LEADERBOARD_TABLE": leaderboard_table.table_name,
                "AGENTPAY_PROGRAM_ID": agentpay_program_id,
            },
            timeout=Duration.seconds(30),
        )

        api_lambda = _lambda.Function(
            self, "ApiFunction",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="api.handler",
            code=_lambda.Code.from_asset("lambda"),
            environment={
                "PAYMENTS_TABLE": payments_table.table_name,
                "WALLETS_TABLE": wallets_table.table_name,
                "LEADERBOARD_TABLE": leaderboard_table.table_name,
            },
            timeout=Duration.seconds(15),
        )

        x402_lambda = _lambda.Function(
            self, "X402FacilitatorFunction",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="x402_facilitator.handler",
            code=_lambda.Code.from_asset("lambda"),
            environment={
                "PAYMENTS_TABLE": payments_table.table_name,
                "AGENTPAY_PROGRAM_ID": agentpay_program_id,
                "X402_DATA_URL": "https://agent-studio-fawn.vercel.app/api/x402/data",
            },
            timeout=Duration.seconds(15),
        )

        # ─── Bedrock Agent Lambda (AWS Track — Native AI) ────────────

        bedrock_policy = iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=[
                "bedrock:InvokeModel",
                "bedrock:InvokeModelWithResponseStream",
            ],
            resources=["*"],
        )

        bedrock_lambda = _lambda.Function(
            self, "BedrockAgentFunction",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="bedrock_agent.handler",
            code=_lambda.Code.from_asset("lambda"),
            environment={
                "BEDROCK_MODEL_ID": "amazon.nova-pro-v1:0",
                "BEDROCK_REGION": "us-east-1",
                "X402_DATA_URL": "https://agent-studio-fawn.vercel.app/api/x402/data",
            },
            timeout=Duration.seconds(30),
        )
        bedrock_lambda.add_to_role_policy(bedrock_policy)

        # ─── Permissions ───────────────────────────────────────────────

        payments_table.grant_read_write_data(indexer_lambda)
        wallets_table.grant_read_write_data(indexer_lambda)
        leaderboard_table.grant_read_write_data(indexer_lambda)

        payments_table.grant_read_data(api_lambda)
        wallets_table.grant_read_data(api_lambda)
        leaderboard_table.grant_read_data(api_lambda)

        payments_table.grant_read_write_data(x402_lambda)

        # ─── API Gateway ──────────────────────────────────────────────

        api = apigw.LambdaRestApi(
            self, "AgentPayApi",
            handler=api_lambda,
            proxy=False,
        )

        v1 = api.root.add_resource("v1")

        # /v1/wallets/{address}/agents
        wallets = v1.add_resource("wallets")
        wallet_address = wallets.add_resource("{address}")
        wallet_address.add_resource("agents").add_method("GET")

        # /v1/wallets/{address}/payments/pending
        wallet_address.add_resource("payments").add_resource("pending").add_method("GET")

        # /v1/wallets/{address}/analytics
        wallet_address.add_resource("analytics").add_method("GET")

        # /v1/leaderboard
        v1.add_resource("leaderboard").add_method("GET")

        # ─── x402 Endpoints (Coinbase Base Track) ─────────────────────

        x402 = v1.add_resource("x402")
        x402_integration = apigw.LambdaIntegration(x402_lambda)

        # GET /v1/x402/services — list available data services
        x402.add_resource("services").add_method("GET", x402_integration)

        # POST /v1/x402/initiate — agent initiates payment
        x402.add_resource("initiate").add_method("POST", x402_integration)

        # POST /v1/x402/verify — verify x402 payment on Base
        x402.add_resource("verify").add_method("POST", x402_integration)

        # GET /v1/x402/status/{requestId} — check payment status
        x402.add_resource("status").add_resource("{requestId}").add_method("GET", x402_integration)

        # POST /v1/x402/webhook — Helius Solana webhook
        x402.add_resource("webhook").add_method("POST", x402_integration)

        # ─── Bedrock Agent Routes (AWS Native AI) ─────────────────────

        bedrock = v1.add_resource("bedrock")
        bedrock_integration = apigw.LambdaIntegration(bedrock_lambda)

        # POST /v1/bedrock/evaluate — Bedrock evaluates x402 payment
        bedrock.add_resource("evaluate").add_method("POST", bedrock_integration)

        # POST /v1/bedrock/discover — Bedrock discovers x402 services
        bedrock.add_resource("discover").add_method("POST", bedrock_integration)

        # ─── SNS for Push Notifications ────────────────────────────────

        notifications_topic = sns.Topic(
            self, "PaymentNotifications",
            display_name="AgentPay Payment Notifications",
        )

        # ─── CloudWatch Observability ──────────────────────────────────

        # Log groups are auto-created by Lambda — CloudWatch metrics are available automatically

        # CloudWatch Dashboard
        dashboard = cloudwatch.Dashboard(
            self, "AgentPayDashboard",
            dashboard_name="AgentPay-Consensus-2026",
        )

        dashboard.add_widgets(
            cloudwatch.GraphWidget(
                title="API Gateway Requests",
                left=[api_lambda.metric_invocations(statistic="Sum", period=Duration.minutes(5))],
                width=12,
            ),
            cloudwatch.GraphWidget(
                title="Lambda Duration (ms)",
                left=[
                    api_lambda.metric_duration(statistic="Average", period=Duration.minutes(5)),
                    x402_lambda.metric_duration(statistic="Average", period=Duration.minutes(5)),
                    bedrock_lambda.metric_duration(statistic="Average", period=Duration.minutes(5)),
                ],
                width=12,
            ),
            cloudwatch.GraphWidget(
                title="x402 Payment Requests",
                left=[x402_lambda.metric_invocations(statistic="Sum", period=Duration.minutes(5))],
                width=12,
            ),
            cloudwatch.GraphWidget(
                title="Bedrock AI Evaluations",
                left=[bedrock_lambda.metric_invocations(statistic="Sum", period=Duration.minutes(5))],
                width=12,
            ),
            cloudwatch.GraphWidget(
                title="Lambda Errors",
                left=[
                    api_lambda.metric_errors(statistic="Sum", period=Duration.minutes(5)),
                    x402_lambda.metric_errors(statistic="Sum", period=Duration.minutes(5)),
                    bedrock_lambda.metric_errors(statistic="Sum", period=Duration.minutes(5)),
                ],
                width=12,
            ),
            cloudwatch.GraphWidget(
                title="DynamoDB Throttles",
                left=[
                    payments_table.metric_throttled_requests(statistic="Sum", period=Duration.minutes(5)),
                ],
                width=12,
            ),
        )

        # CloudWatch Alarms
        api_error_alarm = cloudwatch.Alarm(
            self, "ApiErrorAlarm",
            metric=api_lambda.metric_errors(statistic="Sum", period=Duration.minutes(5)),
            threshold=5,
            evaluation_periods=1,
            alarm_description="API Lambda errors exceed 5 in 5 minutes",
        )

        bedrock_error_alarm = cloudwatch.Alarm(
            self, "BedrockErrorAlarm",
            metric=bedrock_lambda.metric_errors(statistic="Sum", period=Duration.minutes(5)),
            threshold=3,
            evaluation_periods=1,
            alarm_description="Bedrock Lambda errors exceed 3 in 5 minutes",
        )

        # SNS alarm notifications
        api_error_alarm.add_alarm_action(cloudwatch_actions.SnsAction(notifications_topic))
        bedrock_error_alarm.add_alarm_action(cloudwatch_actions.SnsAction(notifications_topic))

        # ─── Outputs ───────────────────────────────────────────────────

        CfnOutput(self, "ApiUrl", value=api.url, description="AgentPay API Gateway URL")
        CfnOutput(self, "PaymentsTableName", value=payments_table.table_name)
        CfnOutput(self, "X402ServicesUrl", value=f"{api.url}v1/x402/services", description="x402 Data Services Catalog")
        CfnOutput(self, "X402InitiateUrl", value=f"{api.url}v1/x402/initiate", description="x402 Payment Initiation")
        CfnOutput(self, "WebhookEndpoint", value=f"{api.url}v1/x402/webhook", description="Helius webhook destination")
        CfnOutput(self, "SnsTopicArn", value=notifications_topic.topic_arn)
        CfnOutput(self, "BedrockEvaluateUrl", value=f"{api.url}v1/bedrock/evaluate", description="Bedrock AI payment evaluation")
        CfnOutput(self, "BedrockDiscoverUrl", value=f"{api.url}v1/bedrock/discover", description="Bedrock AI service discovery")
        CfnOutput(self, "DashboardUrl", value=f"https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=AgentPay-Consensus-2026", description="CloudWatch Dashboard")