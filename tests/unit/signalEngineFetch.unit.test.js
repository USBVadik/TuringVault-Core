describe("signalEngine fetch transport", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("preserves POST options while adding an abort signal", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    const {
      _private: { fetchJson },
    } = require("../../src/orchestrator/signalEngine");

    await fetchJson("https://example.test/info", 1000, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"type":"allMids"}',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/info",
      expect.objectContaining({
        method: "POST",
        body: '{"type":"allMids"}',
        signal: expect.any(AbortSignal),
      })
    );
  });
});
