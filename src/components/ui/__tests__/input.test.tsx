import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "@/components/ui/input";

describe("Input", () => {
  it("renders with placeholder", () => {
    render(<Input placeholder="Enter your name" />);
    expect(
      screen.getByPlaceholderText("Enter your name"),
    ).toBeInTheDocument();
  });

  it("triggers change event when typing", async () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);

    await userEvent.type(screen.getByRole("textbox"), "hello");

    expect(handleChange).toHaveBeenCalledTimes(5);
  });

  it("is not editable when disabled", async () => {
    const handleChange = vi.fn();
    render(<Input disabled onChange={handleChange} />);

    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();

    await userEvent.type(input, "hello");

    expect(handleChange).not.toHaveBeenCalled();
  });
});
