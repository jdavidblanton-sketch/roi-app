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
    imageSrc = "/images/btn_small_copper.png";
  } else if (type === "copper" && size === "long") {
    imageSrc = "/images/button_long_copper.png";
  } else if (type === "gm" && size === "small") {
    imageSrc = "/images/btn_small_gm.png";
  } else if (type === "gm" && size === "long") {
    imageSrc = "/images/btn_long_gm.png";
  }

  // Fallback to styled button if image doesn't exist
  if (!imageSrc) {
    return (
      <button
        onClick={onClick}
        style={{
          backgroundColor: type === "copper" ? "#B87333" : "#2E7D32",
          color: "#FFFFFF",
          border: "none",
          borderRadius: "8px",
          padding: size === "small" ? "8px 16px" : "12px 24px",
          fontSize: size === "small" ? "14px" : "16px",
          fontWeight: 600,
          cursor: "pointer",
          width: "100%",
        }}
      >
        {text}
      </button>
    );
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
          console.error("Button image failed to load:", imageSrc);
          e.currentTarget.style.display = "none";
          // Show fallback text
          const parent = e.currentTarget.parentElement;
          if (parent) {
            const span = document.createElement("span");
            span.textContent = text;
            span.style.color = "#FFFFFF";
            span.style.backgroundColor = type === "copper" ? "#B87333" : "#2E7D32";
            span.style.padding = size === "small" ? "8px 16px" : "12px 24px";
            span.style.borderRadius = "8px";
            span.style.display = "inline-block";
            span.style.width = "100%";
            span.style.textAlign = "center";
            e.currentTarget.style.display = "none";
            parent.appendChild(span);
          }
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