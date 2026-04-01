namespace service.Consumers;

/// <summary>
/// Reads basic identification fields from a raw WMBus frame
/// without full parsing. Used as fallback when the parser
/// cannot handle the encryption method.
///
/// WMBus T-mode frame layout (after L-field):
///   Byte 0:    L-field (length)
///   Byte 1:    C-field (command)
///   Byte 2-3:  M-field (manufacturer, 2 bytes, little-endian)
///   Byte 4-7:  A-field / ID (serial number, 4 bytes BCD, little-endian)
///   Byte 8:    Version
///   Byte 9:    Device type
/// </summary>
public static class WMBusFrameReader
{
    private const int MinHeaderLength = 10;

    public static byte[] NormalizeFrame(byte[] frame)
    {
        if (frame.Length == 0)
            return frame;

        if (HasLengthField(frame))
            return frame;

        var normalizedFrame = new byte[frame.Length + 1];
        normalizedFrame[0] = (byte)normalizedFrame.Length;
        Array.Copy(frame, 0, normalizedFrame, 1, frame.Length);
        return normalizedFrame;
    }

    public static string ReadAField(byte[] frame)
    {
        frame = NormalizeFrame(frame);

        if (frame.Length < MinHeaderLength)
            return "unknown";

        // A-field is a 4-byte BCD serial number stored little-endian.
        return $"{frame[7]:X2}{frame[6]:X2}{frame[5]:X2}{frame[4]:X2}";
    }

    public static string ReadManufacturer(byte[] frame)
    {
        frame = NormalizeFrame(frame);

        if (frame.Length < MinHeaderLength)
            return "unknown";

        // M-field is bytes 2-3, little-endian, encoded as 3 letters (5 bits each)
        int mField = frame[3] << 8 | frame[2];
        char c1 = (char)(((mField >> 10) & 0x1F) + 64);
        char c2 = (char)(((mField >> 5) & 0x1F) + 64);
        char c3 = (char)((mField & 0x1F) + 64);
        return $"{c1}{c2}{c3}";
    }

    private static bool HasLengthField(byte[] frame) =>
        frame.Length > 0 &&
        (frame[0] == frame.Length || frame[0] == frame.Length - 1);
}
