import { placeOwning } from "../src/ui/place"
for (const p of ["/NVIDIA/NeMo-Relay/issues/1700", "/NVIDIA/NeMo-Relay/issues", "/NVIDIA/NeMo-Relay/pull/1611", "/oven-sh/bun/issues/1"]) console.log(p, placeOwning(p, ""))
