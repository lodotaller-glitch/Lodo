import { deleteUser, putUser } from "@/functions/request/userRequest";
import { handleInputChange } from "@/functions/handleChanges";
import { useState } from "react";
import { motion } from "framer-motion";

export default function TableUsers({ users, getUsers }) {
  const [editingId, setEditingId] = useState(null);
  const [editedUser, setEditedUser] = useState({});

  const handleEdit = (user) => {
    setEditingId(user._id);
    setEditedUser(user);
  };

  const handleSave = async () => {
    const res = await putUser(editedUser);
    if (res.data._id) {
      setEditingId(null);
      setEditedUser(null);
      getUsers();
    } else {
      return;
    }
  };

  const handleDelete = async (id) => {
    const res = await deleteUser(id);

    if (res.message === "Ok") {
      setEditingId(null);
      setEditedUser(null);
      getUsers();
    } else {
      return;
    }
  };

  return (
    <div className="overflow-x-auto rounded-xl shadow-lg m-5">
      <table className="min-w-full table-fixed bg-white border border-gray-200">
        <thead className="bg-orange-500 text-white">
          <tr>
            <th className="p-3 text-left">Usuario</th>
            <th className="p-3 text-left">Tipo de Usuario</th>
            <th className="p-3 text-left">Caja</th>
            <th className="p-3 text-left">Contraseña</th>
            <th className="p-3 text-left">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u, index) => (
            <motion.tr
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, delay: index * 0.1 }} // Animación con retraso basado en el índice
              key={u._id}
              className="border-t"
            >
              <td className="p-3 w-1/5">
                {editingId === u._id ? (
                  <input
                    type="text"
                    name="userName"
                    className="inp-orange"
                    value={editedUser.userName}
                    onChange={(e) => handleInputChange(e, setEditedUser)}
                  />
                ) : (
                  u.userName
                )}
              </td>

              <td className="p-3 w-1/5">
                {editingId === u._id ? (
                  <select
                    className="select-orange"
                    name="typeUser"
                    value={editedUser.typeUser}
                    onChange={(e) => handleInputChange(e, setEditedUser)}
                  >
                    <option value="Admin">Admin</option>
                    <option value="Medico">Medico</option>
                    <option value="Empleado">Empleado</option>
                  </select>
                ) : (
                  u.typeUser
                )}
              </td>
              <td className="p-3 w-1/5">
                {editingId === u._id && editedUser.typeUser === "Medico" ? (
                  <input
                    type="text"
                    name="earningsBox"
                    className="inp-orange"
                    value={editedUser.earningsBox}
                    onChange={(e) => handleInputChange(e, setEditedUser)}
                  />
                ) : (
                  u.earningsBox
                )}
              </td>
              <td className="p-3 w-1/5">
                {editingId === u._id ? (
                  <input
                    type="text"
                    name="password"
                    className="inp-orange"
                    value={editedUser.password}
                    onChange={(e) => handleInputChange(e, setEditedUser)}
                  />
                ) : (
                  u?.password
                )}
              </td>
              <td className="p-3 flex gap-2 ">
                {editingId === u._id ? (
                  <button className="btn-green" onClick={handleSave}>
                    Guardar
                  </button>
                ) : (
                  <button className="btn-blue" onClick={() => handleEdit(u)}>
                    Editar
                  </button>
                )}
                {editingId === u._id ? (
                  <button
                    className="btn-red"
                    onClick={() => setEditingId(null)}
                  >
                    Cancelar
                  </button>
                ) : (
                  <button
                    className="btn-red"
                    onClick={() => handleDelete(u._id)}
                  >
                    Borrar
                  </button>
                )}
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
