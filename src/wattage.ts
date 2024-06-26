interface BrightnessWattPair {
  brightness: number;
  watt: number;
}

export function getEstimatedWatt(brightness: number, data: BrightnessWattPair[]): number | null {
  if (!data || data.length === 0) {
    return undefined;
  }

  // Add default value if brightness: 0, watt: 0 doesn't exist
  if (!data.some(pair => pair.brightness === 0)) {
    data.push({ brightness: 0, watt: 0 });
  }

  // Ensure data is sorted by brightness in ascending order
  data.sort((a, b) => a.brightness - b.brightness);

  for (let i = 0; i < data.length - 1; i++) {
    if (brightness >= data[i].brightness && brightness <= data[i + 1].brightness) {
      const deltaBrightness = data[i + 1].brightness - data[i].brightness;
      const deltaWatt = data[i + 1].watt - data[i].watt;
      const brightnessDifference = brightness - data[i].brightness;
      const estimatedWatt = data[i].watt + (deltaWatt / deltaBrightness) * brightnessDifference;
      return estimatedWatt;
    }
  }

  // If the given brightness is outside the range of the provided data
  return null;
}
