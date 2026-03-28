using System.Buffers.Binary;

namespace Simulator;

public static class LansenFrameBuilder
{
    private static readonly byte[] SensorAField = [0x67, 0x00, 0x01, 0x00];

    public static byte[] Build(int seq, double tempC, double humidityPct, int co2Ppm)
    {
        var temp = Int16LE(tempC * 100);
        var hum = Int16LE(humidityPct * 10);
        var co2 = Int16LE(co2Ppm);
        var calib = Int16LE(900);
        var mins = Int16LE(480);
        var sound = Int16LE(40);
        var days = Int16LE(1);
        var ver = Int16LE(4);

        var header = new byte[]
        {
            0x44,       // C-Field
            0x33, 0x30, // M-Field (Lansen)
        };

        var meta = new byte[]
        {
            0x0F,                       // Protocol version
            0x2A,                       // Meter type (CarbonDioxide)
            0x7A,                       // CI-Field
            (byte)(seq & 0xFF),         // Sequence
            0x00,                       // Status
            0x00, 0x00,                 // Config (no encryption)
        };

        using var ms = new MemoryStream(128);
        ms.WriteByte(0); // placeholder for L-Field
        ms.Write(header);
        ms.Write(SensorAField);
        ms.Write(meta);
        ms.Write([0x2F, 0x2F]); // encryption verification

        // Data Records
        WriteRecord(ms, [0x02, 0x65], temp);               // DR1:  Temperature, last
        WriteRecord(ms, [0x42, 0x65], temp);               // DR2:  Temperature, avg 1h
        WriteRecord(ms, [0x82, 0x01, 0x65], temp);         // DR3:  Temperature, avg 24h
        WriteRecord(ms, [0x02, 0xFB, 0x1A], hum);          // DR4:  Humidity, last
        WriteRecord(ms, [0x42, 0xFB, 0x1A], hum);          // DR5:  Humidity, avg 1h
        WriteRecord(ms, [0x82, 0x01, 0xFB, 0x1A], hum);    // DR6:  Humidity, avg 24h
        WriteRecord(ms, [0x02, 0xFD, 0x3A], co2);          // DR7:  CO2, last
        WriteRecord(ms, [0x42, 0xFD, 0x3A], co2);          // DR8:  CO2, avg 1h
        WriteRecord(ms, [0x82, 0x01, 0xFD, 0x3A], co2);    // DR9:  CO2, avg 24h
        WriteRecord(ms, [0xC2, 0x01, 0xFD, 0x3A], calib);  // DR10: Last calibration
        WriteRecord(ms, [0x82, 0x40, 0xFD, 0x3A], mins);   // DR11: Mins to next cal
        WriteRecord(ms, [0x82, 0x80, 0x40, 0xFD, 0x3A], sound); // DR12: Sound dB, last
        WriteRecord(ms, [0xC2, 0x80, 0x40, 0xFD, 0x3A], sound); // DR13: Sound dB, avg 1h
        WriteRecord(ms, [0x82, 0x02, 0x23], days);         // DR14: Uptime days
        WriteRecord(ms, [0x02, 0x27], days);                // DR15: Operating days
        WriteRecord(ms, [0x02, 0xFD, 0x0F], ver);           // DR16: Product version
        ms.Write([0x01, 0xFD, 0x1B, 0x10]);                 // DR17: Status flags

        var frame = ms.ToArray();
        frame[0] = (byte)frame.Length; // L-Field
        return frame;
    }

    private static byte[] Int16LE(double value)
    {
        var clamped = (short)Math.Clamp(Math.Round(value), short.MinValue, short.MaxValue);
        var buf = new byte[2];
        BinaryPrimitives.WriteInt16LittleEndian(buf, clamped);
        return buf;
    }

    private static void WriteRecord(MemoryStream ms, byte[] dib, byte[] value)
    {
        ms.Write(dib);
        ms.Write(value);
    }
}
