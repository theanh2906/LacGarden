"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type StyledSelectOption = { value: string; label: string };

type StyledSelectProps = {
  name?: string;
  options: StyledSelectOption[];
  placeholder?: string;
  defaultValue?: string;
  value?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  onValueChange?: (value: string) => void;
};

export function StyledSelect({
  name,
  options,
  placeholder = "Chọn một mục",
  defaultValue = "",
  value,
  required = false,
  disabled = false,
  className,
  onValueChange
}: StyledSelectProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedValue = value ?? internalValue;
  const selected = options.find((option) => option.value === selectedValue);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function selectOption(nextValue: string) {
    if (value === undefined) setInternalValue(nextValue);
    onValueChange?.(nextValue);
    setOpen(false);
  }

  return (
    <div className="styledSelect" ref={rootRef}>
      {name ? <input type="hidden" name={name} value={selectedValue} aria-required={required} /> : null}
      <button
        type="button"
        className={`styledSelectTrigger ${!selected ? "styledSelectPlaceholder" : ""} ${className ?? ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={placeholder}
        disabled={disabled || !options.length}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span>{selected?.label ?? placeholder}</span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>
      {open ? (
        <div className="styledSelectMenu" role="listbox" aria-label={placeholder}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === selectedValue}
              className={`styledSelectOption ${option.value === selectedValue ? "styledSelectOptionSelected" : ""}`}
              onClick={() => selectOption(option.value)}
            >
              <span>{option.label}</span>
              {option.value === selectedValue ? <Check size={16} aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
