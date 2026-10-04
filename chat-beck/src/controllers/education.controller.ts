import type { Request, Response } from "express";
import { validate } from "../middlewares/validate";
import * as educationService from "../services/education.service";
import { sendData } from "../utils/response";
import { cityDistrictsParams, districtsQuery, institutionsQuery } from "../validators/education.validators";

export async function cities(_req: Request, res: Response) {
  sendData(res, await educationService.listCities());
}

export async function districts(req: Request, res: Response) {
  const { cityId } = validate(districtsQuery, req.query);
  sendData(res, await educationService.listDistricts(cityId));
}

export async function cityDistricts(req: Request, res: Response) {
  const { cityId } = validate(cityDistrictsParams, req.params);
  sendData(res, await educationService.listDistricts(cityId));
}

export async function institutions(req: Request, res: Response) {
  const filters = validate(institutionsQuery, req.query);
  sendData(res, await educationService.listInstitutions(filters));
}
