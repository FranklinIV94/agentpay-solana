"""
AWS Bedrock Agent — Evaluates x402 payment requests using Claude 3.5 Sonnet
Part of the AgentPay/Agent Studio AWS track submission for Consensus 2026.
"""

import json
import boto3
import os

BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "amazon.nova-pro-v1:0")
BEDROCK_REGION = os.environ.get("BEDROCK_REGION", "us-east-1")

# Fallback if Bedrock is not available
FALLBACK_RESPONSE = {
    "approved": True,
    "confidence": 0.75,
    "reasoning": "Bedrock unavailable — auto-approved with reduced confidence",
    "risk_factors": [],
    "recommended_action": "approve"
}


def call_bedrock(prompt: str, max_tokens: int = 500) -> str:
    """Call AWS Bedrock Claude 3.5 Sonnet for AI evaluation."""
    try:
        client = boto3.client("bedrock-runtime", region_name=BEDROCK_REGION)
        
        body = json.dumps({
            "messages": [
                {
                    "role": "user",
                    "content": [{"text": prompt}]
                }
            ],
            "inferenceConfig": {
                "maxTokens": max_tokens,
                "temperature": 0.3,
            },
        })
        
        response = client.invoke_model(
            modelId=BEDROCK_MODEL_ID,
            body=body,
            contentType="application/json",
            accept="application/json"
        )
        
        result = json.loads(response["body"].read())
        # Nova Pro uses different response format
        if "output" in result:
            return result["output"]["message"]["content"][0]["text"]
        elif "content" in result:
            return result["content"][0].get("text", "")
        return str(result)
    except Exception as e:
        print(f"Bedrock call failed: {e}")
        return ""


def evaluate_x402_payment(service_id: str, amount: float, payer_address: str,
                           service_description: str = "") -> dict:
    """
    Use Bedrock to evaluate whether an x402 payment request should be approved.
    
    This demonstrates native AWS AI services for the hackathon judges.
    """
    prompt = f"""You are an AI payment risk evaluator for an x402 (HTTP 402) payment protocol.

A request has been made to pay ${amount:.4f} USDC on Base for the following service:
- Service ID: {service_id}
- Service Description: {service_description}
- Payer Address: {payer_address}

Evaluate this payment request. Consider:
1. Is this amount reasonable for this type of data service?
2. Are there any risk factors?
3. Should this be approved, rejected, or flagged for review?

Respond ONLY in JSON format:
{{
    "approved": true/false,
    "confidence": 0.0-1.0,
    "reasoning": "brief explanation",
    "risk_factors": ["list of any risk factors"],
    "recommended_action": "approve"/"reject"/"review"
}}"""

    bedrock_response = call_bedrock(prompt)
    
    if not bedrock_response:
        return FALLBACK_RESPONSE
    
    try:
        # Extract JSON from response (Claude may wrap it in markdown)
        text = bedrock_response.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        
        return json.loads(text)
    except (json.JSONDecodeError, IndexError):
        return {
            "approved": True,
            "confidence": 0.6,
            "reasoning": f"Bedrock response received but could not parse: {bedrock_response[:100]}",
            "risk_factors": ["unparseable_ai_response"],
            "recommended_action": "approve"
        }


def agent_discovery(query: str) -> dict:
    """
    Use Bedrock to discover available x402 services for a given agent query.
    Demonstrates Bedrock AgentCore-like behavior.
    """
    services = [
        {"id": "market-feed", "name": "Real-Time Market Data", "price": "0.01", "category": "market-data"},
        {"id": "sanctions-screen", "name": "Sanctions Screening", "price": "0.05", "category": "compliance"},
        {"id": "credit-bureau", "name": "Credit Bureau Query", "price": "0.10", "category": "credit"},
        {"id": "risk-signal", "name": "Fraud Risk Signal", "price": "0.02", "category": "insurance"},
        {"id": "fx-rates", "name": "FX Rate Snapshot", "price": "0.01", "category": "market-data"},
    ]
    
    prompt = f"""You are an x402 service discovery agent running on AWS Bedrock.

An AI agent wants to know which data services it needs for this task: "{query}"

Available services:
{json.dumps(services, indent=2)}

Select the most relevant services and explain why. Respond in JSON:
{{
    "relevant_services": ["service_id1", "service_id2"],
    "reasoning": "why these services are needed",
    "estimated_cost": total_cost_in_usdc,
    "agent_plan": "brief plan for how the agent should use this data"
}}"""

    bedrock_response = call_bedrock(prompt)
    
    if not bedrock_response:
        return {
            "relevant_services": ["market-feed", "risk-signal"],
            "reasoning": "Bedrock unavailable — defaulting to market data and risk signal",
            "estimated_cost": 0.03,
            "agent_plan": "fallback plan"
        }
    
    try:
        text = bedrock_response.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        return json.loads(text)
    except (json.JSONDecodeError, IndexError):
        return {
            "relevant_services": ["market-feed"],
            "reasoning": f"Parse error on Bedrock response",
            "estimated_cost": 0.01,
            "agent_plan": "proceed with market data"
        }


def handler(event, context):
    """Lambda handler — routes to Bedrock agent functions."""
    try:
        body = json.loads(event.get("body", "{}")) if isinstance(event.get("body"), str) else event.get("body", {})
        path = event.get("rawPath", event.get("path", ""))
        method = event.get("httpMethod", event.get("requestContext", {}).get("http", {}).get("method", "GET"))
        
        # Route: POST /v1/bedrock/evaluate
        if "/evaluate" in path:
            result = evaluate_x402_payment(
                service_id=body.get("service_id", "unknown"),
                amount=float(body.get("amount", 0)),
                payer_address=body.get("payer_address", "0x0"),
                service_description=body.get("service_description", "")
            )
            return {
                "statusCode": 200,
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"source": "aws-bedrock", "model": BEDROCK_MODEL_ID, **result})
            }
        
        # Route: POST /v1/bedrock/discover
        if "/discover" in path:
            result = agent_discovery(body.get("query", "general market analysis"))
            return {
                "statusCode": 200,
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"source": "aws-bedrock", "model": BEDROCK_MODEL_ID, **result})
            }
        
        # Default: service info
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({
                "service": "AgentPay Bedrock Agent",
                "model": BEDROCK_MODEL_ID,
                "region": BEDROCK_REGION,
                "endpoints": [
                    "POST /v1/bedrock/evaluate — Evaluate x402 payment with Bedrock AI",
                    "POST /v1/bedrock/discover — Discover x402 services with Bedrock AI"
                ],
                "status": "active"
            })
        }
        
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": str(e), "source": "aws-bedrock"})
        }
