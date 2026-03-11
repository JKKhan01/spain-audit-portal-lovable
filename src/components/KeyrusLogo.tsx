import { cn } from "@/lib/utils";
import keyrusLogo from "@/assets/keyrus-logo.png";

interface KeyrusLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const KeyrusLogo = ({ className, size = "md" }: KeyrusLogoProps) => {
  const sizeClasses = {
    sm: "h-6",
    md: "h-8",
    lg: "h-10",
  };

  return (
    <img
      src={keyrusLogo}
      alt="Keyrus"
      className={cn(sizeClasses[size], "w-auto", className)}
    />
  );
};
