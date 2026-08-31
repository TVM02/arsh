export function toRomanIfNumber(value) {
  // If value is NOT a pure number (like "ukg", "Class 1", "A3"), return as-is
  if (!/^\d+$/.test(value)) return value;

  // Convert to number
  let num = Number(value);
  if (num <= 0) return value;

  const romanMap = {
    1000: "M",
    900: "CM",
    500: "D",
    400: "CD",
    100: "C",
    90: "XC",
    50: "L",
    40: "XL",
    10: "X",
    9: "IX",
    5: "V",
    4: "IV",
    1: "I",
  };

  let result = "";
  const keys = Object.keys(romanMap).map(Number).sort((a, b) => b - a);

  keys.forEach(key => {
    while (num >= key) {
      result += romanMap[key];
      num -= key;
    }
  });

  return result;
}
