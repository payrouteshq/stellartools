import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { BaseMessageChunk } from "@langchain/core/messages";
import { type MeteredPlugin, MeteredPluginConfig, createMeteredPlugin } from "@stellartools/plugin-sdk";

export class MeteredLangChain<TModel extends BaseLanguageModel = BaseLanguageModel> {
  private plugin: MeteredPlugin;

  constructor(
    private config: MeteredPluginConfig,
    private model: TModel
  ) {
    this.plugin = createMeteredPlugin(config);
  }

  private extractTokens(output: unknown): number {
    const o = output as Record<string, any>;

    // 1. Standardized metadata (LangChain 0.2+, 0.3+)
    if (o?.usage_metadata?.total_tokens) {
      return o.usage_metadata.total_tokens;
    }

    // 2. Fallback to provider-specific metadata
    const usage = o?.response_metadata?.usage || o?.response_metadata?.tokenUsage;
    if (usage) {
      return (
        usage.totalTokens ??
        usage.total_tokens ??
        (usage.promptTokens ?? usage.prompt_tokens ?? 0) + (usage.completionTokens ?? usage.completion_tokens ?? 0)
      );
    }

    return 0;
  }

  async invoke(
    customerId: string,
    productId: string,
    ...args: Parameters<TModel["invoke"]>
  ): Promise<ReturnType<TModel["invoke"]>> {
    return this.plugin.meter(
      customerId,
      productId,
      () => this.model.invoke(args[0], args[1]) as Promise<ReturnType<TModel["invoke"]>>,
      (result) => this.extractTokens(result),
      { operation: "invoke", model: this.model.constructor.name }
    );
  }

  async *stream(
    customerId: string,
    productId: string,
    ...args: Parameters<TModel["stream"]>
  ): AsyncGenerator<BaseMessageChunk> {
    await this.plugin.preflight(customerId, productId);
    const stream = await this.model.stream(args[0], args[1]);

    let usageFound = 0;
    for await (const chunk of stream) {
      yield chunk;
      const tokens = this.extractTokens(chunk);
      if (tokens > 0) usageFound = tokens;
    }

    if (usageFound > 0) {
      await this.plugin.charge(customerId, productId, usageFound, {
        operation: "stream",
        model: this.model.constructor.name,
      });
    }
  }

  async batch(
    customerId: string,
    productId: string,
    ...args: Parameters<TModel["batch"]>
  ): Promise<ReturnType<TModel["batch"]>> {
    await this.plugin.preflight(customerId, productId);
    const results = await this.model.batch(args[0], args[1]);

    const total = results.reduce((acc, r) => acc + this.extractTokens(r), 0);
    if (total > 0) {
      await this.plugin.charge(customerId, productId, total, {
        operation: "batch",
        model: this.model.constructor.name,
      });
    }

    return results as ReturnType<TModel["batch"]>;
  }

  async *streamEvents(
    customerId: string,
    productId: string,
    ...args: Parameters<TModel["streamEvents"]>
  ): AsyncGenerator<any> {
    await this.plugin.preflight(customerId, productId);
    const events = this.model.streamEvents(args[0], args[1]);

    let total = 0;
    for await (const event of events) {
      yield event;

      if (event.event === "on_chat_model_end" || event.event === "on_llm_end") {
        total += this.extractTokens(event.data.output);
      }
    }

    if (total > 0) {
      await this.plugin.charge(customerId, productId, total, {
        operation: "streamEvents",
        model: this.model.constructor.name,
      });
    }
  }
}
