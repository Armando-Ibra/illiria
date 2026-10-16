using FluentValidation;

namespace Illiria.Api.Platform.Http;

public static class Validation
{
    /// <summary>Validates the <typeparamref name="T"/> argument with its FluentValidation validator; 400 on failure.</summary>
    public static RouteHandlerBuilder WithValidation<T>(this RouteHandlerBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        return builder
            .AddEndpointFilter(async (context, next) =>
            {
                var argument = context.Arguments.OfType<T>().FirstOrDefault();
                if (argument is null)
                {
                    return TypedResults.Problem(statusCode: StatusCodes.Status400BadRequest, title: "A request body is required.");
                }

                var validator = context.HttpContext.RequestServices.GetRequiredService<IValidator<T>>();
                var result = await validator.ValidateAsync(argument, context.HttpContext.RequestAborted);
                return result.IsValid ? await next(context) : TypedResults.ValidationProblem(result.ToDictionary());
            })
            .ProducesValidationProblem();
    }
}
