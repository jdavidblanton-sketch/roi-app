import React from "react";

interface CustomButtonProps {
  type: "copper" | "gm";
  size: "small" | "long";
  text: string;
  onClick?: () => void;
}

export const CustomButton: React.FC<CustomButtonProps> = ({
  type,
  size,
  text,
  onClick,
}) => {
  let imageSrc = "";

  if (type === "copper" && size === "small") {
    imageSrc = "/src/assets/btn_small_copper.png";
  } else if (type === "copper" && size === "long") {
    imageSrc = "/src/assets/btn_long_copper.png";
  } else if (type === "gm" && size === "small") {
    imageSrc = "/src/assets/btn_small_gm.png";
  } else if (type === "gm" && size === "long") {
    imageSrc = "/src/assets/btn_long_gm.png";
  }

  return (
    <button
      onClick={onClick}
      style={{
        position: "relative",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
        width: "100%",
      }}
    >
      <img
        src={imageSrc}
        alt={`${type} ${size} button`}
        style={{
          display: "block",
          width: "100%",
          height: "auto",
        }}
        onError={(e) => {
          console.error(`Button image failed to load: ${imageSrc}`);
          e.currentTarget.style.display = "none";
        }}
      />
      <span
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          color: "#FFFFFF",
          fontSize: size === "small" ? "14px" : "16px",
          fontWeight: 600,
          whiteSpace: "nowrap",
          textShadow: "1px 1px 2px rgba(0,0,0,0.5)",
        }}
      >
        {text}
      </span>
    </button>
  );
};