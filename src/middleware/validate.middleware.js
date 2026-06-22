// ============================================================
// VALIDATION MIDDLEWARE
// ============================================================
// Used for validating request data against Zod schemas

export const validate = (schema) => {
  return async (req, res, next) => {
    try {
      // Parse and validate the request
      const validatedData = schema.parse({
        body: req.body,
        params: req.params,
        query: req.query,
      });

      // Attach validated data to request
      req.validated = validatedData;
      next();
    } catch (error) {
      if (error.name === "ZodError") {
        const message = error.errors[0]?.message || "Validation failed";
        return res.status(400).json({
          success: false,
          message,
          errorCode: "VALIDATION_ERROR",
        });
      }

      next(error);
    }
  };
};

