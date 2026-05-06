#!/usr/bin/env python3
"""
AgentPay CDK App — Deploy with: cdk deploy
"""
import os
import aws_cdk as cdk
from agentpay_stack import AgentPayStack

app = cdk.App()
AgentPayStack(
    app, "AgentPayStack",
    env=cdk.Environment(
        account=os.environ.get("CDK_DEFAULT_ACCOUNT"),
        region=os.environ.get("CDK_DEFAULT_REGION", "us-east-1"),
    ),
    description="AgentPay — AI Agent Payment Manager on Solana with x402 Base Bridge (Consensus 2026 Hackathon)",
)
app.synth()