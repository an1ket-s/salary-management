import { employeesRepository, CreateEmployeeInput, UpdateEmployeeInput, EmployeeFilters } from "../repositories/employees";
import { AppError } from "../middleware/errorHandler";

export const employeesService = {
  async findMany(filters: EmployeeFilters) {
    return employeesRepository.findMany(filters);
  },

  async findById(id: number) {
    const employee = await employeesRepository.findById(id);
    if (!employee) throw new AppError(404, "Employee not found");
    return employee;
  },

  async create(data: CreateEmployeeInput) {
    return employeesRepository.create(data);
  },

  async update(id: number, data: UpdateEmployeeInput) {
    await employeesService.findById(id);
    return employeesRepository.update(id, data);
  },

  async remove(id: number) {
    await employeesService.findById(id);
    return employeesRepository.remove(id);
  },

  async getMeta() {
    return employeesRepository.getMeta();
  },
};
