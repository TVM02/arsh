import {
  NextResponse,
} from "next/server";

import {
  getAdminDb,
} from "@/lib/firebase-admin";


export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";


const COLLECTION_NAME =
  "digitalClassStudentRegistrations";


/* =========================================================
   SERIALIZE FIRESTORE DATA
========================================================= */

function serializeValue(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return value;
  }

  if (
    value &&
    typeof value.toDate ===
      "function"
  ) {
    return value
      .toDate()
      .toISOString();
  }

  if (
    value instanceof Date
  ) {
    return value.toISOString();
  }

  if (
    Array.isArray(value)
  ) {
    return value.map(
      serializeValue
    );
  }

  if (
    typeof value ===
    "object"
  ) {
    const result = {};

    for (
      const [
        key,
        child,
      ] of Object.entries(
        value
      )
    ) {
      result[key] =
        serializeValue(
          child
        );
    }

    return result;
  }

  return value;
}


/* =========================================================
   GET - VIEW ONE REGISTRATION
========================================================= */

export async function GET(
  request,
  { params }
) {
  try {
    const {
      id,
    } =
      await params;


    if (!id) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "Registration ID is required",
        },
        {
          status:
            400,
        }
      );
    }


    const db =
      getAdminDb();


    const registrationRef =
      db
        .collection(
          COLLECTION_NAME
        )
        .doc(id);


    const registrationSnap =
      await registrationRef
        .get();


    if (
      !registrationSnap.exists
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "Registration not found",
        },
        {
          status:
            404,
        }
      );
    }


    const registrationData =
      serializeValue(
        registrationSnap.data() ||
          {}
      );


    return NextResponse.json(
      {
        success:
          true,

        data: {
          id:
            registrationSnap.id,

          ...registrationData,
        },
      },
      {
        status:
          200,
      }
    );

  } catch (error) {
    console.error(
      "VIEW DIGITAL STUDENT REGISTRATION ERROR:",
      {
        message:
          error?.message,

        code:
          error?.code,

        stack:
          error?.stack,
      }
    );


    return NextResponse.json(
      {
        success:
          false,

        message:
          error?.message ||
          "Failed to fetch registration",

        code:
          error?.code ||
          null,
      },
      {
        status:
          500,
      }
    );
  }
}


/* =========================================================
   PATCH - EDIT REGISTRATION
========================================================= */

export async function PATCH(
  request,
  { params }
) {
  try {
    const {
      id,
    } =
      await params;


    const body =
      await request.json();


    if (!id) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "Student ID is required",
        },
        {
          status:
            400,
        }
      );
    }


    const db =
      getAdminDb();


    const ref =
      db
        .collection(
          COLLECTION_NAME
        )
        .doc(id);


    const snap =
      await ref.get();


    if (!snap.exists) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "Student registration not found",
        },
        {
          status:
            404,
        }
      );
    }


    const protectedFields =
      [
        "id",
        "uid",
        "digitalAdmissionNumber",
        "approval",
        "passwordCreated",
      ];


    const updateData = {
      ...body,
    };


    for (
      const field
      of protectedFields
    ) {
      delete updateData[
        field
      ];
    }


    updateData.updatedAt =
      new Date();


    await ref.update(
      updateData
    );


    const updatedSnap =
      await ref.get();


    return NextResponse.json({
      success:
        true,

      message:
        "Registration updated successfully",

      student: {
        id:
          updatedSnap.id,

        ...serializeValue(
          updatedSnap.data() ||
            {}
        ),
      },
    });

  } catch (error) {
    console.error(
      "DIGITAL STUDENT UPDATE ERROR:",
      {
        message:
          error?.message,

        code:
          error?.code,

        stack:
          error?.stack,
      }
    );


    return NextResponse.json(
      {
        success:
          false,

        message:
          error?.message ||
          "Failed to update registration",

        code:
          error?.code ||
          null,
      },
      {
        status:
          500,
      }
    );
  }
}


/* =========================================================
   DELETE - DELETE REGISTRATION
========================================================= */

export async function DELETE(
  request,
  { params }
) {
  try {
    const {
      id,
    } =
      await params;


    if (!id) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "Student registration ID is required",
        },
        {
          status:
            400,
        }
      );
    }


    const db =
      getAdminDb();


    const registrationRef =
      db
        .collection(
          COLLECTION_NAME
        )
        .doc(id);


    const registrationSnap =
      await registrationRef
        .get();


    if (
      !registrationSnap.exists
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "Digital student registration not found",
        },
        {
          status:
            404,
        }
      );
    }


    await registrationRef
      .delete();


    return NextResponse.json(
      {
        success:
          true,

        message:
          "Digital student registration deleted successfully",

        id,
      },
      {
        status:
          200,
      }
    );

  } catch (error) {
    console.error(
      "DELETE DIGITAL STUDENT ERROR:",
      {
        message:
          error?.message,

        code:
          error?.code,

        stack:
          error?.stack,
      }
    );


    return NextResponse.json(
      {
        success:
          false,

        message:
          error?.message ||
          "Failed to delete Digital Classroom student",

        code:
          error?.code ||
          null,
      },
      {
        status:
          500,
      }
    );
  }
}