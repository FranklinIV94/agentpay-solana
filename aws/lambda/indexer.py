"""
AgentPay Indexer — Processes on-chain events via Helius webhooks
Stores payment requests, wallet data, and analytics in DynamoDB
"""

import json
import os
import boto3
from datetime import datetime, timezone
from decimal import Decimal

DYNAMODB = boto3.resource("dynamodb")

PAYMENTS_TABLE = os.environ.get("PAYMENTS_TABLE", "agentpay-payments")
WALLETS_TABLE = os.environ.get("WALLETS_TABLE", "agentpay-wallets")
LEADERBOARD_TABLE = os.environ.get("LEADERBOARD_TABLE", "agentpay-leaderboard")


def handler(event, context):
    """Process Helius webhook payload for AgentPay events"""
    body = json.loads(event.get("body", "[]"))

    # Helius sends array of transactions
    if not isinstance(body, list):
        body = [body]

    results = []

    for tx in body:
        try:
            result = process_transaction(tx)
            results.append(result)
        except Exception as e:
            print(f"Error processing tx: {e}")
            results.append({"error": str(e)})

    return {
        "statusCode": 200,
        "body": json.dumps({"processed": len(results), "results": results}),
    }


def process_transaction(tx: dict) -> dict:
    """Route transaction to appropriate handler based on instruction"""
    # Parse transaction events from Helius enriched format
    events = tx.get("events", {})
    account_data = tx.get("accountData", [])

    # Check for AgentPay program instructions
    for account in account_data:
        # Payment request created
        if account.get("programId") == os.environ.get("AGENTPAY_PROGRAM_ID"):
            return handle_payment_event(tx, account)

    return {"action": "unknown", "tx": tx.get("signature", "unknown")}


def handle_payment_event(tx: dict, account: dict) -> dict:
    """Store payment request and send push notification"""
    payments = DYNAMODB.Table(PAYMENTS_TABLE)
    wallets = DYNAMODB.Table(WALLETS_TABLE)
    leaderboard = DYNAMODB.Table(LEADERBOARD_TABLE)

    signature = tx.get("signature", "unknown")
    owner = account.get("owner", "unknown")
    action = account.get("action", "unknown")

    # Store payment
    payment_item = {
        "paymentId": signature,
        "owner": owner,
        "status": "pending",
        "amount": str(account.get("amount", 0)),
        "reason": account.get("reason", ""),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "txSignature": signature,
    }

    payments.put_item(Item=payment_item)

    # Update leaderboard (atomic increment)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    leaderboard.update_item(
        Key={"ownerId": owner, "date": today},
        UpdateExpression="ADD totalTransactions :inc, totalAmount :amt",
        ExpressionAttributeValues={
            ":inc": 1,
            ":amt": Decimal(str(account.get("amount", 0))),
        },
    )

    # Update wallet stats
    wallets.update_item(
        Key={"owner": owner},
        UpdateExpression="SET lastActivity = :ts ADD totalPayments :inc",
        ExpressionAttributeValues={
            ":ts": datetime.now(timezone.utc).isoformat(),
            ":inc": 1,
        },
    )

    # TODO: Send push notification via FM/APNS
    # send_push_notification(owner, payment_item)

    return {
        "action": "payment_indexed",
        "paymentId": signature,
        "owner": owner,
    }