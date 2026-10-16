using System.Buffers.Binary;
using System.Globalization;
using System.Security.Cryptography;

namespace Illiria.Api.IntegrationTests.Infrastructure;

/// <summary>RFC 6238 TOTP (SHA-1, 6 digits, 30 s), like an authenticator app, for 2FA tests.</summary>
public static class Totp
{
    public static string Code(string base32Key, DateTimeOffset? at = null)
    {
        ArgumentNullException.ThrowIfNull(base32Key);
        var key = Base32Decode(base32Key);
        Span<byte> counter = stackalloc byte[8];
        BinaryPrimitives.WriteInt64BigEndian(counter, (at ?? DateTimeOffset.UtcNow).ToUnixTimeSeconds() / 30);

#pragma warning disable CA5350 // RFC 6238 authenticator codes are defined over HMAC-SHA1.
        var hash = HMACSHA1.HashData(key, counter);
#pragma warning restore CA5350
        var offset = hash[^1] & 0x0F;
        var binary = ((hash[offset] & 0x7F) << 24) | (hash[offset + 1] << 16) | (hash[offset + 2] << 8) | hash[offset + 3];
        return (binary % 1_000_000).ToString("D6", CultureInfo.InvariantCulture);
    }

    private static byte[] Base32Decode(string input)
    {
        const string Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        var clean = input.Replace(" ", "", StringComparison.Ordinal).TrimEnd('=').ToUpperInvariant();
        var output = new List<byte>();
        int buffer = 0, bits = 0;
        foreach (var c in clean)
        {
            buffer = (buffer << 5) | Alphabet.IndexOf(c, StringComparison.Ordinal);
            bits += 5;
            if (bits >= 8)
            {
                output.Add((byte)(buffer >> (bits - 8)));
                bits -= 8;
            }
        }

        return [.. output];
    }
}
