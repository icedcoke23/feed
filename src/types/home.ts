import type { Teacher } from "./teacher";
import type { ClassItem } from "./class";
export type { Teacher } from "./teacher";
export type { ClassItem, ClassFormData } from "./class";
export { EMPTY_CLASS_FORM } from "./class";
import type { Student } from "./student";
export type { Student, StudentFormData, ParsedStudent, StudentClass } from "./student";
export { EMPTY_STUDENT_FORM } from "./student";

export interface HomeDataPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface HomeDataResponse {
  students: Student[];
  studentsPagination: HomeDataPagination;
  classes: ClassItem[];
  teachers: Teacher[];
  adminTeachers: Teacher[];
}
