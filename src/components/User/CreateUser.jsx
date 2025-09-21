import { handleInputChange } from "@/functions/handleChanges";
import { signUpUser } from "@/functions/request/userRequest";
import { motion } from "framer-motion";
import { useState } from "react";

export default function CreateUser({ getUsers }) {
  const [user, setUser] = useState({
    userName: "",
    password: "",
    email: "",
    typeUser: "admin",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await signUpUser(user);
      if (response) {
        setUser({
          userName: "",
          password: "",
          email: "",
          typeUser: "admin",
        });
        getUsers();
        return;
      }
    } catch (error) {
      console.error("Error al enviar la solicitud:", error);
    }
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="bg-orange-50 text-black font-semibold flex flex-col items-center justify-center gap-8 m-5 p-6 rounded-3xl shadow-lg border border-orange-200 max-w-4xl mx-auto"
    >
      <h3 className="text-3xl font-bold text-orange-600">Crear Usuario</h3>
      <div className="container w-full justify-between gap-5">
        <div className="item">
          <label className="block text-sm font-medium mb-1">Usuario</label>
          <input
            className="inp-orange"
            type="text"
            name="userName"
            value={user.userName}
            onChange={(ev) => handleInputChange(ev, setUser)}
          />
        </div>
        <div className="item">
          <label className="block text-sm font-medium mb-1">Contraseña</label>
          <input
            className="inp-orange"
            type="text"
            name="password"
            value={user.password}
            onChange={(ev) => handleInputChange(ev, setUser)}
          />
        </div>

        <div className="item">
          <label className="block text-sm font-medium mb-1">
            Tipo de usuario
          </label>
          <select
            name="typeUser"
            value={user.typeUser}
            onChange={(ev) => handleInputChange(ev, setUser)}
            className="select-orange"
          >
            <option value="admin">Admin</option>
            <option value="student">Estudiante</option>
            <option value="teacher">Porfesor</option>
            <option value="networks">Redes</option>
          </select>
        </div>

        {/* {user.typeUser === "Medico" && ( */}
          <div className="item">
            {/* <AnimatedWrapper show={user.typeUser === "Medico"}> */}
            <label className="block text-sm font-medium mb-1">email</label>
            <input
              className="inp-orange"
              type="email"
              name="email"
              value={user.email}
              onChange={(ev) => handleInputChange(ev, setUser)}
            />
            {/* </AnimatedWrapper> */}
          </div>
        {/* )} */}
      </div>
      <div className="w-[200px]">
        <button className="btn-orange" type="submit">
          Crear Usuario
        </button>
      </div>
    </motion.form>
  );
}
