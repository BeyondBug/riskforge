"""AWS service adapters. Each one degrades to a local fallback."""

from app.services.bedrock import BedrockService, get_bedrock_service
from app.services.dynamodb import DynamoDBService, get_dynamodb_service
from app.services.s3 import S3Service, get_s3_service

__all__ = [
    "DynamoDBService",
    "get_dynamodb_service",
    "S3Service",
    "get_s3_service",
    "BedrockService",
    "get_bedrock_service",
]
