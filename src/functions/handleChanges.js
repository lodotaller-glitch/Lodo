export const handleInputChange = (e, setData) => {
  const { name, value, files } = e.target;

  setData((prevData) => ({
    ...prevData,
    [name]: files ? files[0] : value,
  }));
};
export const handleCheckboxChange = (e, setData) => {
  const { name, checked, files } = e.target;

  setData((prevData) => ({
    ...prevData,
    [name]: files ? files[0] : checked,
  }));
};

export const handleObjectInputChange = (e, setData) => {
  const { name, value, files } = e.target;
  const inputValue = files ? files[0] : value;

  setData((prevData) => {
    const keys = name.split(".");
    let updatedValue = { ...prevData };

    for (let i = 0; i < keys.length - 1; i++) {
      updatedValue = updatedValue[keys[i]];
    }
    updatedValue[keys[keys.length - 1]] = inputValue;

    return { ...prevData };
  });
};


