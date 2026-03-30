import worker from "./.open-next/worker.js";
import { PresenceHub as PresenceHubImpl } from "./lib/durable-objects/presence-hub";

export * from "./.open-next/worker.js";
export class PresenceHub extends PresenceHubImpl {}

export default worker;