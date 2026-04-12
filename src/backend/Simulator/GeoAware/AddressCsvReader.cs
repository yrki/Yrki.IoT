using System.Globalization;

namespace Simulator.GeoAware;

public static class AddressCsvReader
{
    public static IReadOnlyList<AddressRecord> Read(string csvPath)
    {
        var records = new List<AddressRecord>();

        foreach (var line in File.ReadLines(csvPath).Skip(1))
        {
            var fields = ParseCsvLine(line);
            if (fields.Count < 7)
                continue;

            if (!double.TryParse(fields[5], CultureInfo.InvariantCulture, out var lat) ||
                !double.TryParse(fields[6], CultureInfo.InvariantCulture, out var lon))
                continue;

            records.Add(new AddressRecord(
                Address: fields[0],
                PostalCode: fields[3],
                PostalLocality: fields[4],
                Latitude: lat,
                Longitude: lon));
        }

        return records;
    }

    private static List<string> ParseCsvLine(string line)
    {
        var fields = new List<string>();
        var inQuotes = false;
        var current = new System.Text.StringBuilder();

        foreach (var ch in line)
        {
            if (ch == '"')
            {
                inQuotes = !inQuotes;
            }
            else if (ch == ',' && !inQuotes)
            {
                fields.Add(current.ToString());
                current.Clear();
            }
            else
            {
                current.Append(ch);
            }
        }

        fields.Add(current.ToString());
        return fields;
    }
}
