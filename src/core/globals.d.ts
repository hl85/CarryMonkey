// src/globals.d.ts

interface TrustedTypePolicy {
  createScript(input: string): string;
}

interface TrustedTypePolicyFactory {
  createPolicy(
    policyName: string,
    policyOptions: {
      createScript: (input: string) => string;
    },
  ): TrustedTypePolicy;
  emptyScript: string;
}

interface Window {
  trustedTypes?: TrustedTypePolicyFactory;
}
