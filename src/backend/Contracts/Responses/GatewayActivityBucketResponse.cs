namespace Contracts.Responses;

public record GatewayActivityBucketResponse(
    DateTimeOffset Hour,
    int ContactCount);
