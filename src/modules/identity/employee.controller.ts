import type { Request, Response } from 'express';
import { created, ok } from '../../utils/response';
import { employeeService } from './employee.service';
import type {
  CreateEmployeeBody,
  EmployeeIdParam,
  ListEmployeesQuery,
  UpdateEmployeeBody,
  UpdateEmployeeStatusBody,
} from './employee.validators';

async function list(req: Request, res: Response) {
  const query = req.query as unknown as ListEmployeesQuery;
  const result = await employeeService.listEmployees(query);
  ok(res, result.data, { ...result.meta });
}

async function getById(req: Request, res: Response) {
  const { id } = req.params as unknown as EmployeeIdParam;
  const employee = await employeeService.getEmployeeById(id);
  ok(res, employee);
}

async function create(req: Request, res: Response) {
  const body = req.body as CreateEmployeeBody;
  const employee = await employeeService.createEmployee(body);
  created(res, employee);
}

async function update(req: Request, res: Response) {
  const { id } = req.params as unknown as EmployeeIdParam;
  const body = req.body as UpdateEmployeeBody;
  const employee = await employeeService.updateEmployee(id, body);
  ok(res, employee);
}

async function updateStatus(req: Request, res: Response) {
  const { id } = req.params as unknown as EmployeeIdParam;
  const { status } = req.body as UpdateEmployeeStatusBody;
  const employee = await employeeService.updateEmployeeStatus(id, status);
  ok(res, employee);
}

export const employeeController = {
  list,
  getById,
  create,
  update,
  updateStatus,
};
