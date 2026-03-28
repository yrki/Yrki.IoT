#!/usr/bin/env python3
"""
Lansen E2 CO2-S WMBus simulator.

Generates syntetic, ukrypterte Lansen CO2-sensor payloads og skriver dem
til en seriellport (eller virtuell PTY) hvert 20. sekund.

CO2 oscillerer jevnt mellom 800 og 1600 ppm på en sinusbølge (~10 min periode).
Temperatur og luftfuktighet varierer realistisk i takt.

Bruk:
    python3 lansen-co2-simulator.py <serial_port>

Eksempel:
    python3 lansen-co2-simulator.py /dev/ttys004
"""

import math
import os
import struct
import sys
import time

# ──────────────────────────────────────────────────────────────────
# Sensor-konfigurasjon
# ──────────────────────────────────────────────────────────────────
SENSOR_A_FIELD = bytes([0x67, 0x00, 0x01, 0x00])   # AField → "00010067"
CYCLE_STEPS    = 30                                  # 30 × 20 s = 10 min periode
INTERVAL_S     = 20


# ──────────────────────────────────────────────────────────────────
# Hjelpefunksjoner
# ──────────────────────────────────────────────────────────────────
def i16le(value: int) -> bytes:
    """Int16 little-endian bytes (clamps to valid range)."""
    return struct.pack('<h', max(-32768, min(32767, int(value))))


def build_frame(seq: int, temp_c: float, humidity_pct: float, co2_ppm: int) -> bytes:
    """
    Bygger en komplett WMBus-melding for Lansen E2 CO2-S.

    Feltlayout (uten kryptering):
      Byte 0       : L-Field (= total meldinglengde inkl. L-Field)
      Byte 1       : C-Field = 0x44
      Byte 2–3     : M-Field = 0x33 0x30  (LAS = Lansen)
      Byte 4–7     : A-Field (enhets-ID)
      Byte 8       : Protocol version = 0x0F
      Byte 9       : Meter type = 0x2A  (CO2 / CarbonDioxide)
      Byte 10      : CI-Field = 0x7A
      Byte 11      : Sekvensnummer
      Byte 12      : Status = 0x00
      Byte 13–14   : Config (kryptering) = 0x00 0x00  (ingen kryptering)
      Byte 15–16   : 2F 2F  (krypteringsverifisering)
      Byte 17+     : Data Records (DR1–DR17)
    """
    temp  = i16le(round(temp_c * 100))
    hum   = i16le(round(humidity_pct * 10))
    co2   = i16le(co2_ppm)
    calib = i16le(900)
    mins  = i16le(480)
    sound = i16le(40)
    days  = i16le(1)
    ver   = i16le(4)

    header = bytes([
        0x44,
        0x33, 0x30,
    ]) + SENSOR_A_FIELD + bytes([
        0x0F,                   # Protocol version
        0x2A,                   # Meter type (CarbonDioxide)
        0x7A,                   # CI-Field
        seq & 0xFF,             # Sekvensnummer
        0x00,                   # Status
        0x00, 0x00,             # Config — ingen kryptering
    ])

    data_records = (
        b'\x02\x65'             + temp  +   # DR1:  Temperatur, siste måling
        b'\x42\x65'             + temp  +   # DR2:  Temperatur, snitt siste time
        b'\x82\x01\x65'        + temp  +   # DR3:  Temperatur, snitt siste 24 t
        b'\x02\xFB\x1A'        + hum   +   # DR4:  Luftfuktighet, siste måling
        b'\x42\xFB\x1A'        + hum   +   # DR5:  Luftfuktighet, snitt siste time
        b'\x82\x01\xFB\x1A'   + hum   +   # DR6:  Luftfuktighet, snitt siste 24 t
        b'\x02\xFD\x3A'        + co2   +   # DR7:  CO2, siste måling  ← variert
        b'\x42\xFD\x3A'        + co2   +   # DR8:  CO2, snitt siste time
        b'\x82\x01\xFD\x3A'   + co2   +   # DR9:  CO2, snitt siste 24 t
        b'\xC2\x01\xFD\x3A'   + calib +   # DR10: Siste kalibreringsverdi
        b'\x82\x40\xFD\x3A'   + mins  +   # DR11: Minutter til neste kalibrering
        b'\x82\x80\x40\xFD\x3A' + sound + # DR12: Lydnivå dB, siste måling
        b'\xC2\x80\x40\xFD\x3A' + sound + # DR13: Lydnivå dB, snitt siste time
        b'\x82\x02\x23'        + days  +   # DR14: Oppetid i dager
        b'\x02\x27'            + days  +   # DR15: Driftstid i dager
        b'\x02\xFD\x0F'        + ver   +   # DR16: Produktversjon
        b'\x01\xFD\x1B\x10'                # DR17: Status (bit4 = CO2 oppdatert)
    )

    body = header + b'\x2F\x2F' + data_records
    l_field = 1 + len(body)     # Lansen: L-Field = total meldinglengde inkl. seg selv

    return bytes([l_field]) + body


# ──────────────────────────────────────────────────────────────────
# Sinusbølge-generator
# ──────────────────────────────────────────────────────────────────
def sine_value(step: int, period: int, lo: float, hi: float, phase: float = 0.0) -> float:
    t = (step % period) / period
    return lo + (hi - lo) * 0.5 * (1.0 + math.sin(2 * math.pi * t + phase))


# ──────────────────────────────────────────────────────────────────
# Hovedløkke
# ──────────────────────────────────────────────────────────────────
def main() -> None:
    if len(sys.argv) < 2:
        print(f"Bruk: {sys.argv[0]} <seriell_port>", file=sys.stderr)
        sys.exit(1)

    port_path = sys.argv[1]

    try:
        fd = os.open(port_path, os.O_WRONLY | os.O_NOCTTY)
    except OSError as exc:
        print(f"Kan ikke åpne {port_path}: {exc}", file=sys.stderr)
        sys.exit(1)

    print(f"Lansen CO2-simulator startet på {port_path}")
    print(f"CO2: 800–1600 ppm (sinus, ~{CYCLE_STEPS * INTERVAL_S // 60} min periode)")
    print(f"Sender hvert {INTERVAL_S}. sekund. Ctrl+C for å avslutte.\n")

    step = 0
    seq  = 0

    try:
        while True:
            co2      = round(sine_value(step, CYCLE_STEPS, 800,  1600, phase=0.0))
            temp     =       sine_value(step, CYCLE_STEPS,  21.0,  23.0, phase=0.5)
            humidity =       sine_value(step, CYCLE_STEPS,  45.0,  55.0, phase=1.0)

            frame    = build_frame(seq, temp, humidity, co2)
            hex_line = frame.hex().upper() + '\n'

            os.write(fd, hex_line.encode('ascii'))

            print(
                f"[{time.strftime('%H:%M:%S')}]  "
                f"seq={seq:3d}  CO2={co2:4d} ppm  "
                f"Temp={temp:.1f}°C  Hum={humidity:.1f}%"
            )

            step += 1
            seq   = (seq + 1) & 0xFF
            time.sleep(INTERVAL_S)

    except KeyboardInterrupt:
        print("\nSimulator stoppet.")
    finally:
        os.close(fd)


if __name__ == '__main__':
    main()
