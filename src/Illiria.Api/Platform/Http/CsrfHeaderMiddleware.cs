namespace Illiria.Api.Platform.Http;

/// <summary>
/// Auth is a SameSite cookie, so a cross-site form post could ride on it. Every state-changing /api request
/// must carry <c>X-CSRF: 1</c>: a custom header can only be added by same-origin script (cross-origin it
/// needs a CORS preflight, and this API enables no CORS).
/// </summary>
public sealed class CsrfHeaderMiddleware(RequestDelegate next)
{
    public const string HeaderName = "X-CSRF";

    public async Task InvokeAsync(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        var request = context.Request;
        if (request.Path.StartsWithSegments("/api")
            && !(HttpMethods.IsGet(request.Method) || HttpMethods.IsHead(request.Method) || HttpMethods.IsOptions(request.Method))
            && !request.Headers.ContainsKey(HeaderName))
        {
            await Results.Problem(
                statusCode: StatusCodes.Status403Forbidden,
                title: $"Missing {HeaderName} header.").ExecuteAsync(context);
            return;
        }

        await next(context);
    }
}
