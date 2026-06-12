# Phase 7: Advanced Matchmaking and Scale

## Status

- [ ] Not started

## Objective

Handle higher traffic and more complex matchmaking constraints.

## Implementation Checklist

- [ ] Region-aware rules
- [ ] Latency-aware rules
- [ ] Accept or decline handshake
- [ ] Dispute states
- [ ] Partitioned pool processing
- [ ] Optional Redis and BullMQ adoption

## NestJS Modules

- [ ] Revisit `queues`
- [ ] Revisit `matches`
- [ ] Add worker-oriented modules only when justified

## Database Work

- [ ] Add fields and tables required by advanced constraints
- [ ] Revisit partitioning and processing ownership boundaries

## API Endpoints

- [ ] Add only the endpoints required by the selected advanced workflows

## Internal Services

- [ ] Add worker and scheduling services only when scale justifies them

## When to Introduce Redis and BullMQ

- [ ] Database-backed processors are too slow
- [ ] Webhook volume becomes bursty
- [ ] Strict worker isolation is needed
- [ ] Scheduling and retry load starts competing with API latency

## Done Checklist

- [ ] System can scale beyond simple hobby traffic
- [ ] Architecture can separate public API from worker processes cleanly

## Notes

- No source evidence yet for Redis, BullMQ, handshake flows, dispute handling, or partitioned pool processing.
