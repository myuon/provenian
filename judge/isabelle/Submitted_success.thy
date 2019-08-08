theory Submitted
imports Main
begin

theorem goal: "even (length (xs @ rev xs))"
  by simp

end
