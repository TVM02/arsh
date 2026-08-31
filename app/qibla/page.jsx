"use client";

import { useEffect, useState } from "react";

const KAABA_LAT = 21.422487;
const KAABA_LNG = 39.826206;

export default function QiblaPage() {
  const [location, setLocation] = useState(null);
  const [qibla, setQibla] = useState(null);
  const [heading, setHeading] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // --------------------------------------------------
  // Get Qibla direction
  // --------------------------------------------------
  const getQibla = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://api.aladhan.com/v1/qibla/${lat}/${lng}`
      );

      if (!response.ok) {
        throw new Error("Qibla API failed");
      }

      const result = await response.json();

      if (!result?.data?.direction) {
        throw new Error("Invalid Qibla response");
      }

      setQibla(result.data.direction);
    } catch (err) {
      console.error(err);
      setError("Unable to calculate Qibla direction.");
    }
  };

  // --------------------------------------------------
  // Get user location
  // --------------------------------------------------
  const getLocation = () => {
    setLoading(true);
    setError("");

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        setLocation({
          lat,
          lng,
        });

        await getQibla(lat, lng);

        setLoading(false);
      },
      (err) => {
        console.error(err);

        setError(
          "Location permission denied. Please allow location access."
        );

        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  // --------------------------------------------------
  // Request compass permission
  // --------------------------------------------------
  const enableCompass = async () => {
    try {
      if (
        typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function"
      ) {
        const permission =
          await DeviceOrientationEvent.requestPermission();

        if (permission !== "granted") {
          setError("Compass permission was denied.");
          return;
        }
      }

      window.addEventListener(
        "deviceorientationabsolute",
        handleOrientation,
        true
      );

      window.addEventListener(
        "deviceorientation",
        handleOrientation,
        true
      );
    } catch (err) {
      console.error(err);
      setError("Unable to access compass.");
    }
  };

  // --------------------------------------------------
  // Device compass
  // --------------------------------------------------
  const handleOrientation = (event) => {
    let currentHeading = null;

    // iPhone / iPad
    if (typeof event.webkitCompassHeading === "number") {
      currentHeading = event.webkitCompassHeading;
    }

    // Android / other browsers
    else if (typeof event.alpha === "number") {
      currentHeading = 360 - event.alpha;
    }

    if (currentHeading !== null) {
      setHeading(normalizeDegrees(currentHeading));
    }
  };

  // --------------------------------------------------
  // Start
  // --------------------------------------------------
  const startQibla = async () => {
    await enableCompass();
    getLocation();
  };

  // --------------------------------------------------
  // Normalize angle
  // --------------------------------------------------
  const normalizeDegrees = (degree) => {
    return ((degree % 360) + 360) % 360;
  };

  // --------------------------------------------------
  // Distance to Kaaba
  // --------------------------------------------------
  const calculateDistance = () => {
    if (!location) return null;

    const R = 6371;

    const lat1 = toRadians(location.lat);
    const lat2 = toRadians(KAABA_LAT);

    const deltaLat = toRadians(
      KAABA_LAT - location.lat
    );

    const deltaLng = toRadians(
      KAABA_LNG - location.lng
    );

    const a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLng / 2) ** 2;

    const c =
      2 *
      Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
      );

    return R * c;
  };

  const toRadians = (degree) => {
    return (degree * Math.PI) / 180;
  };

  const distance = calculateDistance();

  // --------------------------------------------------
  // Qibla arrow rotation
  // --------------------------------------------------
  const arrowRotation =
    qibla !== null
      ? normalizeDegrees(qibla - heading)
      : 0;

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-950 via-slate-950 to-black text-white flex items-center justify-center px-4 py-10">

      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-7">

          <div className="text-5xl mb-4">
            🕋
          </div>

          <h1 className="text-4xl font-bold">
            Qibla Finder
          </h1>

          <p className="text-emerald-200/70 mt-2">
            Find the direction of the Holy Kaaba
          </p>

        </div>


        {/* Main Card */}
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl p-6">

          {/* Status */}
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center mb-7">

            {loading ? (
              <p className="text-emerald-300">
                📍 Getting your location...
              </p>
            ) : qibla !== null ? (
              <p className="text-emerald-300">
                🧭 Qibla direction detected
              </p>
            ) : (
              <p className="text-white/60">
                Tap the button to find your Qibla
              </p>
            )}

          </div>


          {/* Compass */}
          <div className="flex justify-center mb-7">

            <div className="relative w-72 h-72 rounded-full">

              {/* Compass outer */}
              <div className="absolute inset-0 rounded-full border-8 border-white/10 bg-gradient-to-br from-emerald-900 to-slate-950 shadow-[inset_0_0_40px_rgba(0,0,0,.6),0_20px_50px_rgba(0,0,0,.4)]">

                {/* North */}
                <span className="absolute top-5 left-1/2 -translate-x-1/2 text-red-400 font-bold">
                  N
                </span>

                {/* East */}
                <span className="absolute right-5 top-1/2 -translate-y-1/2 font-bold">
                  E
                </span>

                {/* South */}
                <span className="absolute bottom-5 left-1/2 -translate-x-1/2 font-bold">
                  S
                </span>

                {/* West */}
                <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold">
                  W
                </span>


                {/* Compass center */}
                <div className="absolute inset-0 flex items-center justify-center">

                  {/* Arrow */}
                  <div
                    className="absolute w-2 h-28 origin-bottom transition-transform duration-150"
                    style={{
                      transform: `translateY(-50%) rotate(${arrowRotation}deg)`,
                    }}
                  >

                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-24 rounded-full bg-amber-400 shadow-[0_0_20px_rgba(251,191,36,.7)]" />

                    <div className="absolute top-0 left-1/2 -translate-x-1/2 border-l-[14px] border-r-[14px] border-b-[28px] border-l-transparent border-r-transparent border-b-amber-400" />

                  </div>


                  {/* Center */}
                  <div className="relative z-10 w-16 h-16 rounded-full bg-black border-4 border-amber-400 flex items-center justify-center text-2xl shadow-lg">
                    🕋
                  </div>

                </div>

              </div>

            </div>

          </div>


          {/* Degree */}
          <div className="text-center mb-7">

            <div className="text-4xl font-bold text-amber-400">
              {qibla !== null
                ? `${qibla.toFixed(1)}°`
                : "--"}
            </div>

            <p className="text-sm text-white/50 mt-1">
              Qibla bearing from North
            </p>

          </div>


          {/* Information */}
          <div className="grid grid-cols-2 gap-3 mb-6">

            <InfoBox
              title="Latitude"
              value={
                location
                  ? location.lat.toFixed(5)
                  : "--"
              }
            />

            <InfoBox
              title="Longitude"
              value={
                location
                  ? location.lng.toFixed(5)
                  : "--"
              }
            />

            <InfoBox
              title="Qibla"
              value={
                qibla !== null
                  ? `${qibla.toFixed(1)}°`
                  : "--"
              }
            />

            <InfoBox
              title="Distance"
              value={
                distance
                  ? `${distance.toFixed(0)} km`
                  : "--"
              }
            />

          </div>


          {/* Button */}
          <button
            onClick={startQibla}
            disabled={loading}
            className="w-full rounded-2xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold py-4 transition-all shadow-lg"
          >

            {loading
              ? "Finding Qibla..."
              : "📍 Find My Qibla"}

          </button>


          {/* Error */}
          {error && (
            <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-center text-sm text-red-300">
              {error}
            </div>
          )}


          {/* Help */}
          <p className="text-center text-xs text-white/40 mt-5 leading-relaxed">
            Allow location and compass permissions for
            accurate Qibla direction.
          </p>

        </div>

      </div>

    </main>
  );
}


// --------------------------------------------------
// Information Box
// --------------------------------------------------

function InfoBox({ title, value }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">

      <p className="text-xs text-emerald-200/50 mb-1">
        {title}
      </p>

      <p className="font-semibold">
        {value}
      </p>

    </div>
  );
}