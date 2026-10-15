using System.Text.Json;
using System.Text.Json.Serialization;

namespace Illiria.Api.IntegrationTests.Infrastructure;

public static class Json
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };
}
