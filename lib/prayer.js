export async function getPrayerTimes(city = "Kollam") {
  const response = await fetch(
    `https://api.aladhan.com/v1/timingsByCity?city=${city}&country=India&method=1`,
    {
      cache: "no-store",
    },
  );

  const data = await response.json();

  return data.data;
}
