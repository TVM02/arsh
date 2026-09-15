import { getAdminDb } from "@/lib/firebase-admin";

export async function generateDigitalAdmissionNumber() {
  const db = getAdminDb();

  const counterRef = db
    .collection("systemCounters")
    .doc("digitalClassStudent");

  const nextNumber = await db.runTransaction(
    async (transaction) => {
      const snapshot =
        await transaction.get(counterRef);

      let currentNumber = 0;

      if (snapshot.exists) {
        currentNumber =
          snapshot.data()?.lastNumber || 0;
      }

      const newNumber =
        currentNumber + 1;

      transaction.set(
        counterRef,
        {
          lastNumber: newNumber,
          updatedAt: new Date(),
        },
        {
          merge: true,
        }
      );

      return newNumber;
    }
  );

  const groupOne = Math.floor(
    nextNumber / 1_000_000
  )
    .toString()
    .padStart(3, "0");

  const groupTwo = (
    nextNumber % 1_000_000
  )
    .toString()
    .padStart(6, "0");

  return `DIG-${groupOne}-${groupTwo}`;
}