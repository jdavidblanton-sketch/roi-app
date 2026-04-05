import React from "react";
import btnSmallCopper from '../assets/btn_small_copper.png';
import btnLongCopper from '../assets/btn_long_copper.png';
import btnSmallGm from '../assets/btn_small_gm.png';
import btnLongGm from '../assets/btn_long_gm.png';

interface CustomButtonProps {
  type: "copper" | "gm";
  size: "small" | "long";
  text: string;
  onClick?: () => void;
}

export const CustomButton: React.FC<CustomButtonProps> = ({ type, size, text, onClick }) => {
  let imageSrc = "";
  if (type === "copper" && size === "small") imageSrc = btnSmallCopper;
  else if (type === "copper" && size === "long") imageSrc = btnLongCopper;
  else if (type === "gm" && size === "small") imageSrc = btnSmallGm;
  else if (type === "gm" && size === "long") imageSrc = btnLongGm;

  return (
    <button onClick={onClick} style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
      <img src={imageSrc} alt="button" style={{ display: "block", width: "100%", height: "auto" }} />
      <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", color: "#FFF", fontSize: size === "small" ? "14px" : "16px", fontWeight: 600, whiteSpace: "nowrap", textShadow: "1px 1px 2px rgba(0,0,0,0.5)" }}>{text}</span>
    </button>
  );
};