import { accesAdmin, accesEmployee } from "@/lib/authserver";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";

export const POST = async (req) => {
  try {
    await dbConnect();

    const acces = accesAdmin(req);

    if (!acces) {
      return NextResponse.json(
        { error: "No tienes permiso para ver esto" },
        { status: 401 }
      );
    }

    const { userName, password, email, typeUser } = await req.json();

    if (!userName || !password || !typeUser) {
      return NextResponse.json(
        { error: "No Has Cargado Los Datos" },
        { status: 401 }
      );
    }

    const dataUser = {
      userName,
      password,
      typeUser,
      email,
    };

    const userDoc = await User.create(dataUser);
    const { password: userPass, ...rest } = userDoc._doc;
    const response = NextResponse.json(
      {
        user: rest,
      },
      {
        status: 200,
      }
    );

    return response;
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
};

export const GET = async (req) => {
  try {
    await dbConnect();
    const _id = new URL(req.url).searchParams.get("id");

    const acces = accesEmployee(req);

    if (!acces) {
      return NextResponse.json(
        { error: "No tienes permiso para ver esto" },
        { status: 401 }
      );
    }

    if (_id) {
      const user = await User.findById(_id).select("-password");
      if (user) {
        return NextResponse.json(user, { status: 200 });
      } else {
        return NextResponse.json(
          { error: "No se ha encontrado el usuario" },
          { status: 404 }
        );
      }
    } else {
      const typeUser = new URL(req.url).searchParams.get("typeUser");

      const filter = {};

      if (typeUser) {
        filter.typeUser = typeUser;
      }

      const users = await User.find(filter).select("-password");

      if (users) {
        return NextResponse.json(users, { status: 200 });
      } else {
        return NextResponse.json(
          { error: "No se han encontrado usuarios" },
          { status: 404 }
        );
      }
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
};

export const PUT = async (req) => {
  try {
    await dbConnect();
    const body = await req.json();

    const acces = accesAdmin(req, true);

    if (!acces) {
      return NextResponse.json(
        { error: "No tienes permiso para ver esto" },
        { status: 401 }
      );
    }

    if (!body._id) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }
    const userToUpdate = await User.findById({ _id: body._id });

    userToUpdate.userName = body.userName;
    userToUpdate.typeUser = body.typeUser;

    if (body.password) {
      userToUpdate.password = body.password;
    }
    if (body.earningsBox) {
      userToUpdate.earningsBox = body.earningsBox;
    }

    await userToUpdate.save();

    const { password: userPass, ...rest } = userToUpdate._doc;

    return NextResponse.json(rest, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
};

export const DELETE = async (req) => {
  try {
    await dbConnect();
    const _id = new URL(req.url).searchParams.get("id");

    const acces = accesAdmin(req, true);

    if (!acces) {
      return NextResponse.json(
        { error: "No tienes permiso para ver esto" },
        { status: 401 }
      );
    }

    if (!_id) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }
    await User.deleteOne({ _id });
    return NextResponse.json({ message: "Ok" }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
};
