const eslint = require("eslint");

const subscriberFunctionName = "eslintLoaderCombinedReportPluginSubscriber";
const pluginName = "eslint-loader-report-plugin";

var filePath = loaderUtils.interpolateName(
    webpack,
    config.outputReport.filePath,
    {
        content: res.results
            .map(function(r) {
            return r.source;
        })
        .join("\n")
    }
);

class EslintLoaderCombinedReportPlugin {
    constructor (options) {
        this.options = {
            formatter: "stylish",
            filePath: "eslint-results.txt",
            ...options
        };

        this.engine = new eslint.CLIEngine(this.options);
        this.formatter = (typeof options.formatter === "function") ? options.formatter : this.engine.getFormatter(options.formatter);
    }

    apply (compiler) {
        let results = {};
        const combinedStats = {
            errorCount: 0,
            warningCount: 0,
            fixableErrorCount: 0,
            fixableWarningCount: 0
        };

        compiler.hooks.compilation.tap(pluginName, (compilation) => {
            compilation.hooks.normalModuleLoader.tap(pluginName, (context, module) => {
                context[subscriberFunctionName] = (lintReport) => {
                    if (!results.hasOwnProperty[module.resource]) {
                        const reportableResults = lintReport.results.reduce((acc, res) => {
                            if (res.errorCount === 0 && res.warningCount === 0) {
                                return acc;
                            }
                            const filteredMessages = res.messages.filter(msg => msg.severity > 0);
                            if (filteredMessages.length > 0) {
                                return [
                                    ...acc,
                                    {
                                        ...res,
                                        messages: filteredMessages
                                    }
                                ];
                            }
                        }, []);
                        if (reportableResults.length > 0) {
                            results[module.resource] = reportableResults;
                            combinedStats.errorCount += lintReport.errorCount;
                            combinedStats.fixableErrorCount += lintReport.fixableErrorCount;
                            combinedStats.warningCount += lintReport.warningCount;
                            combinedStats.fixableWarningCount += lintReport.fixableWarningCount;
                        }
                    }
                }
            });
        });

        compiler.hooks.emit.tapAsync(pluginName, (compilation, callback) => {
            const report = {
                ...combinedStats,
                results: [...Object.values(results)].reduce((acc, curr) => ([...acc, ...curr]), [])
            };

            const formattedReport = this.formatter(report.results);

            compilation.assets[this.options.filePath] = {
                source: () => formattedReport,
                size: () => formattedReport.length
            };

            // clear internal data
            results = {};
            combinedStats.errorCount = 0;
            combinedStats.fixableErrorCount = 0;
            combinedStats.warningCount = 0;
            combinedStats.fixableWarningsCount = 0;

            callback();
        });
    }
}

module.exports = EslintLoaderCombinedReportPlugin;
module.exports.subscriberFunctionName = subscriberFunctionName;
