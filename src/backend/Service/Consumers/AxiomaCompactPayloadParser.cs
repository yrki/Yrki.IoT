using System.Security.Cryptography;

namespace service.Consumers;

public static class AxiomaCompactPayloadParser
{
    public static IReadOnlyList<Core.Models.SensorReading> Parse(
        byte[] rawMessage,
        string sensorId,
        string manufacturer,
        DateTimeOffset timestamp,
        string encryptionKey)
    {
        var decryptedPayload = Decrypt(rawMessage, encryptionKey);
        return ParseReadings(decryptedPayload, sensorId, manufacturer, timestamp);
    }

    private static byte[] Decrypt(byte[] rawMessage, string encryptionKey)
    {
        var iv = BuildInitializationVector(rawMessage);
        var encryptedPayload = rawMessage[15..];
        var key = Convert.FromHexString(encryptionKey);

        using var aes = Aes.Create();
        aes.Mode = CipherMode.CBC;
        aes.Padding = PaddingMode.None;
        aes.Key = key;
        aes.IV = iv;

        using var decryptor = aes.CreateDecryptor();
        return decryptor.TransformFinalBlock(encryptedPayload, 0, encryptedPayload.Length);
    }

    private static byte[] BuildInitializationVector(byte[] rawMessage)
    {
        var iv = new byte[16];
        Array.Copy(rawMessage, 2, iv, 0, 8);
        for (var i = 8; i < iv.Length; i++)
        {
            iv[i] = rawMessage[11];
        }

        return iv;
    }

    private static IReadOnlyList<Core.Models.SensorReading> ParseReadings(
        byte[] decryptedPayload,
        string sensorId,
        string manufacturer,
        DateTimeOffset timestamp)
    {
        double? totalVolume = null;
        double? positiveVolume = null;
        double? negativeVolume = null;
        double? flow = null;

        var index = 0;
        while (index < decryptedPayload.Length)
        {
            if (decryptedPayload[index] == 0x2F)
            {
                index++;
                continue;
            }

            if (index + 1 >= decryptedPayload.Length)
                break;

            var dif = decryptedPayload[index];
            var vif = decryptedPayload[index + 1];

            if (dif == 0x04 && vif == 0x6D)
            {
                index += 6;
                continue;
            }

            if (dif == 0x0C && vif == 0x13 && index + 5 < decryptedPayload.Length)
            {
                totalVolume = DecodeBcd(decryptedPayload.AsSpan(index + 2, 4)) * 0.001d;
                index += 6;
                continue;
            }

            if (dif == 0x0C && vif == 0x93 && index + 6 < decryptedPayload.Length)
            {
                var storageVif = decryptedPayload[index + 2];
                if (storageVif == 0x3B)
                    positiveVolume = DecodeBcd(decryptedPayload.AsSpan(index + 3, 4)) * 0.001d;
                else if (storageVif == 0x3C)
                    negativeVolume = DecodeBcd(decryptedPayload.AsSpan(index + 3, 4)) * 0.001d;

                index += 7;
                continue;
            }

            if (dif == 0x0B && vif == 0x3B && index + 4 < decryptedPayload.Length)
            {
                flow = DecodeBcd(decryptedPayload.AsSpan(index + 2, 3));
                index += 5;
                continue;
            }

            break;
        }

        return Readings(timestamp, sensorId, manufacturer,
            ("TotalVolume", totalVolume ?? positiveVolume),
            ("PositiveVolume", positiveVolume),
            ("NegativeVolume", negativeVolume),
            ("Flow", flow));
    }

    private static double DecodeBcd(ReadOnlySpan<byte> bytes)
    {
        double multiplier = 1;
        double value = 0;

        foreach (var current in bytes)
        {
            value += (current & 0x0F) * multiplier;
            multiplier *= 10;
            value += ((current >> 4) & 0x0F) * multiplier;
            multiplier *= 10;
        }

        return value;
    }

    private static IReadOnlyList<Core.Models.SensorReading> Readings(
        DateTimeOffset timestamp,
        string sensorId,
        string manufacturer,
        params (string Type, double? Value)[] measurements) =>
        measurements
            .Where(m => m.Value.HasValue)
            .Select(m => new Core.Models.SensorReading
            {
                Timestamp = timestamp,
                SensorId = sensorId,
                Manufacturer = manufacturer,
                SensorType = m.Type,
                Value = (decimal)m.Value!.Value
            })
            .ToList();
}
