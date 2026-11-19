# 08: Speculative LLM Multi-Model Racing, UTC Temporal Consistency, and Resilient Biomechanical Coaching

**Author:** Gagandeep Singh  
**Roll No.:** 1024031027  
**Module:** Backend Architecture, Concurrent LLM Speculative Racing & Session Temporal Consistency  

## Error:

Building directly upon the backend persistence architecture (Journal 05) and multi-exercise RAG coaching engine (Journal 06 & 07), relying on a single synchronous generative LLM endpoint for post-workout coaching synthesis introduced single-point-of-failure vulnerabilities during peak training hours. Upstream API capacity spikes returned HTTP 503 ("Service Unavailable / High Demand") or HTTP 429 ("Quota / Rate Limit Exceeded"), blocking server threads for up to 25 seconds before falling back to deterministic advice. In addition, session timestamps recorded without explicit UTC normalization caused chronological drift and ordering discrepancies between client telemetry and SQLite queries, and coaching prompts lacked a consistent professional strength-coach persona.

## Relevant Context

In Journal 05, we established the relational schema and backend validation contract ensuring that rep counts, timestamps, and form scores are verified before persistence. In Journal 06 and 07, we implemented personalized baseline injection and exercise-isolated TF-IDF knowledge retrieval (`knowledge_base.json`), guaranteeing that squat, push-up, and deadlift guidance remains strictly partitioned.

To convert session telemetry into structured, schema-validated JSON (`CoachingAnalyzeResponse`), the backend communicates with Google Gemini. Different model variants provide distinct latency profiles and availability tiers:
- `gemini-4-hydrogen` & `gemini-3.8-flash`: Rapid reasoning and concise athletic synthesis.
- `gemini-3.5-flash-lite` & `gemini-3.1-flash-lite`: High-throughput endpoints with generous rate limits (15 RPM / 500 RPD).
- `gemini-2.5-flash`: Standard baseline fallback.

## Key Observation

1. **Speculative Execution (Hedged Requests):** In distributed architectures, waiting sequentially for a primary LLM request to time out before attempting a fallback model compounds latency ($T_{total} = T_{timeout} + T_{fallback}$). By dispatching requests concurrently across a prioritized candidate model pool and accepting the *first schema-valid response*, P99 latency drops to that of the fastest responding healthy endpoint.
2. **Early Task Cancellation:** Fanning out requests across multiple models risks burning token quotas if all tasks run to completion. As soon as the first valid JSON payload passes validation, all remaining in-flight tasks must be cancelled immediately.
3. **UTC Temporal Normalization:** In Journal 05, timestamps were stored as ISO strings. However, if the client sends timestamps with variable local timezone offsets or naive datetimes, chronological ordering and dashboard aggregation queries break. All incoming datetimes must be normalized to UTC at the API boundary, with naive datetimes treated strictly as UTC.
4. **Professional Strength Coach Tone:** Feedback must balance biomechanical precision with accessibility: pairing formal terminology (*hip hinge, knee valgus, lockout, torso angle*) with direct, actionable cues for the lifter's next session.

## Solution

1. **Speculative Model Racing Engine (`backend/app/services/coaching.py`):**
   Implemented an asynchronous model racing routine utilizing standard library `asyncio` and `httpx.AsyncClient`:
   ```python
   async def _race_gemini_models(
       models: list[str],
       prompt: str,
       api_key: str,
       deadline_seconds: float = 6.0,
   ) -> tuple[str | None, dict[str, Any] | None]:
       async with httpx.AsyncClient() as client:
           tasks = [asyncio.create_task(_call_single_model(client, m, prompt, api_key)) for m in models]
           try:
               for fut in asyncio.as_completed(tasks, timeout=deadline_seconds):
                   try:
                       model, result = await fut
                       if result:
                           for t in tasks:
                               t.cancel()  # Immediate cancellation of remaining in-flight tasks
                           logger.info("Coaching model '%s' won the race", model)
                           return model, result
                   except Exception:
                       continue
           except asyncio.TimeoutError:
               logger.warning("All %d models timed out after %.1fs", len(models), deadline_seconds)
           finally:
               for t in tasks:
                   t.cancel()
       return None, None
   ```

2. **Asynchronous Router Integration (`backend/app/routers/coaching.py`):**
   Converted the `/api/coaching/analyze` route handler to native `async def`, non-blockingly awaiting `analyze_session_coaching` on FastAPI's main event loop. If all candidate models fail or the 6.0-second deadline expires, the system seamlessly falls back to deterministic RAG coaching.

3. **UTC Timestamp Normalization & Rescoring (`backend/app/models.py` & `backend/app/rescore_sessions.py`):**
   Enforced strict UTC datetime handling across all session creation and retrieval endpoints, treating naive timestamps as UTC to ensure deterministic chronological ordering in SQLite and dashboard aggregations. Added the `rescore_sessions` utility to recalculate stored historical scores under updated view-aware scoring rules.

4. **Technical yet Accessible Prompt Engineering:**
   Refactored the LLM prompt to instruct models to maintain an objective, constructive strength-coach persona. The prompt explicitly directs the model to incorporate standard biomechanical terminology (*hip hinge, trunk lean, knee valgus, lockout, eccentric control*) while translating them into clear, practical movement cues.

## Because

Speculative multi-model racing eliminates downtime caused by individual model rate limits or high-demand throttling, early cancellation prevents token wastage, UTC normalization ensures reliable cross-platform data integrity, and accessible technical prompt engineering ensures lifters receive prompt, credible, and practical coaching feedback.
