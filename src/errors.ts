export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export class GitHubApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}

export class ReviewParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewParseError";
  }
}
