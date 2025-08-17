import jwt from "jsonwebtoken";

const secretKey = process?.env?.SECRET_KEY;

export function accesAdmin(req, noNet) {
  try {
    const token = req.cookies.get("user");

    if (!token.value) {
      return false;
    }

    const isTokenValid = jwt.verify(token.value, secretKey);

    if (
      (isTokenValid.typeUser !== "admin" &&
        isTokenValid.typeUser !== "networks") ||
      (noNet && isTokenValid.typeUser !== "admin")
    ) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

export function accesEmployee(req) {
  try {
    const token = req.cookies.get("user");
    console.log(token);
    

    if (!token.value) {
      return false;
    }

    const isTokenValid = jwt.verify(token.value, secretKey);

    if (
      !(
        isTokenValid.typeUser === "admin" ||
        isTokenValid.typeUser === "teacher" ||
        isTokenValid.typeUser === "networks"
      )
    ) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

export function accesSatelite(req) {
  try {
    const token = req.cookies.get("user");

    if (!token.value) {
      return false;
    }

    const isTokenValid = jwt.verify(token.value, secretKey);

    if (
      !(
        isTokenValid.typeUser === "Admin" ||
        isTokenValid.typeUser === "Satelite"
      )
    ) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}
export function accesAll(req) {
  try {
    const token = req.cookies.get("user");

    if (!token.value) {
      return false;
    }

    const isTokenValid = jwt.verify(token.value, secretKey);

    if (
      !(
        isTokenValid.typeUser === "Admin" ||
        isTokenValid.typeUser === "Satelite" ||
        isTokenValid.typeUser === "Empleado" ||
        isTokenValid.typeUser === "Facturador"
      )
    ) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}
