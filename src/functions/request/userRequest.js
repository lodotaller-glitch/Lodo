/** @format */

import api from "@/lib/axios";
import Swal from "sweetalert2";

const url = "/users";

export async function signUpUser(user) {
  try {
    const response = await api.post(url, user);
    return response;
  } catch (error) {
    throw error;
  }
}

export async function loginUser({ userName, password }) {
  try {
    const response = await api.post(url + "/login", {
      userName,
      password,
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export async function logOutUser() {
  try {
    const response = await api.post(url + "/logOut");
    return response;
  } catch (error) {
    throw error;
  }
}

export async function getAllUsers(filter) {
  try {
    let data = "";
    if (filter?.typeUser) {
      data += "?typeUser=" + filter.typeUser;
    }
    const response = await api.get(url + data);
    return response;
  } catch (error) {
    throw error;
  }
}

export async function getIdUser(id) {
  try {
    const response = await api.get(url + "?id=" + id);
    return response;
  } catch (error) {
    throw error;
  }
}

export async function putUser({
  _id,
  userName,
  password,
  typeUser,
  earningsBox,
}) {
  try {
    const data = {
      _id,
      userName,
      email,
      typeUser,
    };

    if (password) {
      data.password = password;
    }
    const response = await api.put(url, data);
    return response;
  } catch (error) {
    throw error;
  }
}

export async function deleteUser(id) {
  try {
    const result = await Swal.fire({
      title: "¿Estás seguro?",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#1E88E5",
      cancelButtonColor: "#1E2124",
      cancelButtonText: "Cancelar",
      confirmButtonText: "Sí, borrar",
    });

    if (result.isConfirmed) {
      const { data } = await api.delete(url + "?id=" + id);
      Swal.fire({
        title: "Borrado",
        text: "El registro ha sido eliminado.",
        icon: "success",
      });
      return data;
    }
  } catch (error) {
    throw error;
  }
}
