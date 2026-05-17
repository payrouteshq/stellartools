import * as customersId from "../app/api/customers/[customerId]/route";
import * as customers from "../app/api/customers/route";

export const forceLoad = [customers, customersId];
