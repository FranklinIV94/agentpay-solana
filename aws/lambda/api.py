"""
AgentPay API — REST API for mobile app
Fetches pending payments, leaderboard, analytics from DynamoDB
"""

import json
import os
import boto3
from datetime import datetime, timezone

DYNAMODB = boto3.resource("dynamodb")

PAYMENTS_TABLE = os.environ.get("PAYMENTS_TABLE", "agentpay-payments")
WALLETS_TABLE = os.environ.get("WALLETS_TABLE", "agentpay-wallets")
LEADERBOARD_TABLE = os.environ.get("LEADERBOARD_TABLE", "agentpay-leaderboard")


def handler(event, context):
    """Route API requests"""
    path = event.get("path", "")
    method = event.get("httpMethod", "GET")

    # GET /v1/wallets/{address}/payments/pending
    if "/payments/pending" in path and method == "GET":
        address = path.split("/wallets/")[1].split("/")[0]
        return get_pending_payments(address)

    # GET /v1/wallets/{address}/agents
    if "/agents" in path and method == "GET":
        address = path.split("/wallets/")[1].split("/")[0]
        return get_agent_wallets(address)

    # GET /v1/leaderboard
    if "/leaderboard" in path and method == "GET":
        return get_leaderboard()

    # GET /v1/wallets/{address}/analytics
    if "/analytics" in path and method == "GET":
        address = path.split("/wallets/")[1].split("/")[0]
        return get_analytics(address)

    return {"statusCode": 404, "body": json.dumps({"error": "Not found"})}


def get_pending_payments(owner: str) -> dict:
    """Get all pending payment requests for an owner"""
    table = DYNAMODB.Table(PAYMENTS_TABLE)
    response = table.query(
        IndexName="owner-status-index",
        KeyConditionExpression="owner = :owner AND #status = :status",
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={":owner": owner, ":status": "pending"},
    )
    return {"statusCode": 200, "body": json.dumps(response.get("Items", []))}


def get_agent_wallets(owner: str) -> dict:
    """Get all agent wallets for an owner"""
    table = DYNAMODB.Table(WALLETS_TABLE)
    response = table.query(
        KeyConditionExpression="owner = :owner",
        ExpressionAttributeValues={":owner": owner},
    )
    return {"statusCode": 200, "body": json.dumps(response.get("Items", []))}


def get_leaderboard() -> dict:
    """Get top agent operators by transaction volume"""
    table = DYNAMODB.Table(LEADERBOARD_TABLE)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    response = table.query(
        IndexName="date-score-index",
        KeyConditionExpression="#date = :today",
        ExpressionAttributeNames={"#date": "date"},
        ExpressionAttributeValues={":today": today},
        ScanIndexForward=False,
        Limit=20,
    )
    return {"statusCode": 200, "body": json.dumps(response.get("Items", []))}


def get_analytics(owner: str) -> dict:
    """Get spending analytics for an owner"""
    payments = DYNAMODB.Table(PAYMENTS_TABLE)

    # Get last 30 days of payments
    response = payments.query(
        IndexName="owner-status-index",
        KeyConditionExpression="owner = :owner",
        ExpressionAttributeValues={":owner": owner},
    )

    items = response.get("Items", [])
    total_spent = sum(float(item.get("amount", "0")) for item in items)
    approved = len([i for i in items if i.get("status") == "approved"])
    rejected = len([i for i in items if i.get("status") == "rejected"])

    return {
        "statusCode": 200,
        "body": json.dumps(
            {
                "owner": owner,
                "totalSpent": total_spent,
                "totalTransactions": len(items),
                "approvedCount": approved,
                "rejectedCount": rejected,
                "approvalRate": approved / len(items) if items else 0,
                "period": "30d",
            }
        ),
    }