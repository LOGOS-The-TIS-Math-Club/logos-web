import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export function ApplicationInput({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`application-input ${className}`} />;
}
export function ApplicationTextarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props} className={`application-textarea ${className}`} />
  );
}
