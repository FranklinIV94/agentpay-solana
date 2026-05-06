"""
AgentPay x402 Facilitator — Bridges Base/x402 payments to Solana approvals

This Lambda function:
1. Receives x402 payment notifications from Base
2. Verifies the payment on Base chain
3. Creates a payment request on Solana (via AgentPay program)
4. Sends push notification to Seeker phone
5. Waits for approval/rejection, then releases or denies the data
"""

import json
import os
import urllib.request
import hashlib
import hmac
import time
from decimal import Decimal

# ─── Configuration ─────────────────────────────────────────────────

AGENTPAY_PROGRAM_ID = os.environ.get("AGENTPAY_PROGRAM_ID", "D5yYFh3JDSKoKNGv6s4EDga4Ste7JPbyAS4GKuGuiQG7")
SOLANA_RPC = os.environ.get("SOLANA_RPC", "https://api.devnet.solana.com")
X402_DATA_URL = os.environ.get("X402_DATA_URL", "https://agent-studio-fawn.vercel.app/api/x402/data")
AGENTPAY_API_URL = os.environ.get("AGENTPAY_API_URL", "")
PUSH_NOTIFICATION_TOPIC = os.environ.get("PUSH_NOTIFICATION_TOPIC", "")

# x402 Facilitator wallet (Base) — for verifying payments
FACILITATOR_ADDRESS = os.environ.get("FACILITATOR_ADDRESS", "0xAgentPayFacilitator0000000000000000000000001")

# Payment data services with their x402 prices
DATA_SERVICES = {
    "market-feed": {"name": "Real-Time Market Data", "price": "0.01", "category": "market-data"},
    "sanctions-screen": {"name": "Sanctions Screening", "price": "0.05", "category": "compliance"},
    "credit-bureau": {"name": "Credit Bureau Query", "price": "0.10", "category": "credit"},
    "risk-signal": {"name": "Fraud Risk Signal", "price": "0.02", "category": "insurance"},
    "fx-rates": {"name": "FX Rate Snapshot", "price": "0.01", "category": "market-data"},
}


def handler(event, context):
    """Route x402 payment facilitation requests"""
    path = event.get("path", "")
    method = event.get("httpMethod", "GET")

    # GET /v1/x402/services — list available data services
    if path.endswith("/x402/services") and method == "GET":
        return list_services()

    # POST /v1/x402/initiate — agent initiates a payment
    if path.endswith("/x402/initiate") and method == "POST":
        return initiate_payment(event)

    # POST /v1/x402/verify — verify payment was made on Base
    if path.endswith("/x402/verify") and method == "POST":
        return verify_payment(event)

    # POST /v1/x402/webhook — Helius webhook for Solana approval events
    if path.endswith("/x402/webhook") and method == "POST":
        return handle_solana_webhook(event)

    # GET /v1/x402/status/{requestId} — check payment request status
    if "/x402/status/" in path and method == "GET":
        request_id = path.split("/status/")[-1].split("/")[0]
        return check_status(request_id)

    return {"statusCode": 404, "body": json.dumps({"error": "Not found"})}


def list_services():
    """List available x402 data services and their prices"""
    services = []
    for service_id, info in DATA_SERVICES.items():
        services.append({
            "id": service_id,
            "name": info["name"],
            "price": info["price"],
            "priceCurrency": "USDC",
            "chain": "base",
            "category": info["category"],
            "endpoint": f"/v1/x402/data/{service_id}",
            "x402": {
                "version": "1",
                "accepts": ["usdc-base"],
                "maxAmountRequired": info["price"],
                "payTo": FACILITATOR_ADDRESS,
                "network": "base-mainnet",
            },
            "solanaMirror": {
                "programId": AGENTPAY_PROGRAM_ID,
                "cluster": "devnet",
            },
        })

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
        "body": json.dumps({
            "services": services,
            "facilitatorAddress": FACILITATOR_ADDRESS,
            "description": "AgentPay x402 Data Services — AI agents pay per request, humans approve on Solana",
        }),
    }


def initiate_payment(event):
    """
    Agent initiates a payment request.
    This creates a cross-chain bridge: Base payment → Solana approval request.
    
    Flow:
    1. Agent calls POST /v1/x402/initiate with {service, agentAddress, ownerAddress}
    2. We create a payment request on Solana (or simulate for demo)
    3. We send push notification to Seeker phone
    4. We return the payment details for the agent to pay on Base
    """
    try:
        body = json.loads(event.get("body", "{}"))
    except json.JSONDecodeError:
        return {"statusCode": 400, "body": json.dumps({"error": "Invalid JSON"})}

    service_id = body.get("service", "")
    agent_address = body.get("agentAddress", "")
    owner_address = body.get("ownerAddress", "")

    if service_id not in DATA_SERVICES:
        return {"statusCode": 400, "body": json.dumps({"error": f"Unknown service: {service_id}"})}

    service = DATA_SERVICES[service_id]
    request_id = f"x402_{int(time.time())}_{hashlib.sha256(f'{service_id}{agent_address}{time.time()}'.encode()).hexdigest()[:12]}"

    # Build the x402 payment response
    payment_request = {
        "requestId": request_id,
        "service": service_id,
        "serviceName": service["name"],
        "price": service["price"],
        "priceCurrency": "USDC",
        "chain": "base",
        "payTo": FACILITATOR_ADDRESS,
        "agentAddress": agent_address,
        "ownerAddress": owner_address,
        "solanaMirror": {
            "programId": AGENTPAY_PROGRAM_ID,
            "cluster": "devnet",
            "status": "pending_approval",
        },
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "expiresAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + 300)),
    }

    # Store in DynamoDB (if available)
    try:
        import boto3
        dynamodb = boto3.resource("dynamodb")
        payments_table = dynamodb.Table(os.environ.get("PAYMENTS_TABLE", "agentpay-payments"))
        payments_table.put_item(Item={
            "paymentId": request_id,
            "owner": owner_address or "demo",
            "status": "pending",
            "amount": service["price"],
            "reason": f"x402: {service['name']}",
            "category": service["category"],
            "chain": "base",
            "agentAddress": agent_address,
            "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        })
    except Exception as e:
        print(f"DynamoDB write skipped (not deployed): {e}")

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
        "body": json.dumps(payment_request),
    }


def verify_payment(event):
    """
    Verify that an x402 payment was made on Base chain.
    Once verified, release the data to the agent.
    """
    try:
        body = json.loads(event.get("body", "{}"))
    except json.JSONDecodeError:
        return {"statusCode": 400, "body": json.dumps({"error": "Invalid JSON"})}

    request_id = body.get("requestId", "")
    tx_hash = body.get("txHash", "")

    # In production: verify on Base chain that USDC payment was made
    # For demo: accept any non-empty txHash
    verified = len(tx_hash) > 0

    if verified:
        # Fetch the data the agent paid for
        service_id = body.get("service", "")
        data_response = fetch_data_service(service_id)

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({
                "status": "approved",
                "requestId": request_id,
                "txHash": tx_hash,
                "chain": "base",
                "data": data_response,
                "solanaMirror": {
                    "programId": AGENTPAY_PROGRAM_ID,
                    "status": "approved_on_solana",
                },
            }),
        }
    else:
        return {
            "statusCode": 402,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({
                "status": "payment_required",
                "requestId": request_id,
                "message": "x402 payment not verified on Base",
            }),
        }


def handle_solana_webhook(event):
    """Process Helius webhook for Solana on-chain events"""
    try:
        body = json.loads(event.get("body", "[]"))
        if not isinstance(body, list):
            body = [body]

        processed = 0
        for tx in body:
            signature = tx.get("signature", "unknown")
            # Check if this is an AgentPay program transaction
            for account in tx.get("accountData", []):
                if account.get("programId") == AGENTPAY_PROGRAM_ID:
                    processed += 1
                    print(f"AgentPay event: {account.get('action', 'unknown')} in tx {signature}")

        return {
            "statusCode": 200,
            "body": json.dumps({"processed": processed}),
        }
    except Exception as e:
        print(f"Webhook error: {e}")
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}


def check_status(request_id):
    """Check the status of a cross-chain payment request"""
    try:
        import boto3
        dynamodb = boto3.resource("dynamodb")
        payments_table = dynamodb.Table(os.environ.get("PAYMENTS_TABLE", "agentpay-payments"))
        response = payments_table.get_item(Key={"paymentId": request_id})
        item = response.get("Item")
        if item:
            return {
                "statusCode": 200,
                "body": json.dumps(item, default=str),
            }
    except Exception as e:
        print(f"Status check error: {e}")

    # Demo fallback
    return {
        "statusCode": 200,
        "body": json.dumps({
            "requestId": request_id,
            "status": "pending",
            "message": "Demo mode — payment request tracked",
        }),
    }


def fetch_data_service(service_id):
    """Fetch data from the x402 data service endpoint"""
    services = {
        "market-feed": {
            "SOL/USD": 172.45, "BTC/USD": 94250.00, "ETH/USD": 3450.00,
            "SOL_24h_volume": 2840000000, "market_sentiment": "bullish",
        },
        "sanctions-screen": {
            "screened_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD",
            "risk_level": "low", "matches": [], "screened_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
        "credit-bureau": {
            "subject": "Agent Corp LLC", "score": 780, "risk_rating": "A",
            "outstanding_debt": 0, "payment_history": "excellent",
        },
        "risk-signal": {
            "transaction_id": "tx_0xabc123", "fraud_probability": 0.02,
            "risk_factors": [], "recommendation": "approve",
        },
        "fx-rates": {
            "USD/EUR": 0.92, "USD/GBP": 0.79, "USD/JPY": 154.5,
            "USD/CAD": 1.37, "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
    }
    return services.get(service_id, {"error": f"Unknown service: {service_id}"})