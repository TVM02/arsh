export async function getHijriDate() {
  const response = await fetch("https://api.aladhan.com/v1/gToH");

  const data = await response.json();

  return data.data;
}
